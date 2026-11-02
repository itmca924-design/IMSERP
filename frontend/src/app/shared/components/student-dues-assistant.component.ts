import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { LocalDatetimePipe } from '../pipes/local-datetime.pipe';
import { environment } from '../../../environments/environment';
import { TimeoutError, timeout } from 'rxjs';

interface DuesAssistantMatch {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className?: string | null;
  batchName?: string | null;
}

interface DuesAssistantBreakdown {
  category: string;
  amount: number;
}

interface DuesAssistantPeriodBreakdown {
  period: string;
  amount: number;
}

interface DuesAssistantResponse {
  status: string;
  reply: string;
  studentId?: string | null;
  studentName?: string | null;
  rollNumber?: string | null;
  className?: string | null;
  batchName?: string | null;
  totalDue?: number | null;
  breakdown?: DuesAssistantBreakdown[] | null;
  periods?: DuesAssistantPeriodBreakdown[] | null;
  asOfUtc?: string | null;
  matches?: DuesAssistantMatch[] | null;
}

interface AssistantMessage {
  sender: 'user' | 'assistant';
  text: string;
  speechText?: string;
  question?: string;
  response?: DuesAssistantResponse;
  dueSlipPrompt?: DueSlipStudent;
  dueSlipDownload?: DueSlipStudent;
}

interface DueSlipStudent {
  studentId: string;
  studentName: string;
  rollNumber?: string | null;
  className?: string | null;
  batchName?: string | null;
}

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike extends ArrayLike<SpeechRecognitionAlternativeLike> {
  readonly isFinal: boolean;
}

interface SpeechRecognitionResultEventLike extends Event {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

const VOICE_LANGUAGE_STORAGE_KEY = 'imserp_student_dues_voice_language';

@Component({
  selector: 'app-student-dues-assistant',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    LocalDatetimePipe
  ],
  template: `
    <div class="assistant-dialog">
      <header class="assistant-header">
        <div class="assistant-icon"><mat-icon>psychology</mat-icon></div>
        <div class="assistant-heading">
          <h2>Student Dues Assistant</h2>
          <p>Verified dues from this ERP</p>
        </div>
        <button type="button" class="close-button" mat-icon-button (click)="closeAssistant()" aria-label="Close assistant">
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <div class="assistant-content">
        <div class="messages" #messagesContainer aria-live="polite">
          @for (message of messages; track $index) {
            <div class="message-row" [class.user-row]="message.sender === 'user'">
              <div class="message-bubble" [class.user-bubble]="message.sender === 'user'">
                {{ message.text }}
                @if (message.response; as response) {
                  @if (response.totalDue !== null && response.totalDue !== undefined) {
                    <div class="due-total">
                      <span>Total outstanding</span>
                      <strong>{{ response.totalDue | currency:'INR':'symbol':'1.2-2' }}</strong>
                    </div>
                    @if (response.periods?.length) {
                      <div class="period-breakdown">
                        <span class="period-heading">Unpaid billed fees by month</span>
                        @for (period of response.periods; track period.period) {
                          <div class="breakdown-row">
                            <span>{{ period.period }}</span>
                            <strong>{{ period.amount | currency:'INR':'symbol':'1.2-2' }}</strong>
                          </div>
                        }
                      </div>
                    }
                    @if (response.breakdown?.length) {
                      <div class="due-breakdown">
                        @for (item of response.breakdown; track item.category) {
                          <div class="breakdown-row">
                            <span>{{ item.category }}</span>
                            <strong>{{ item.amount | currency:'INR':'symbol':'1.2-2' }}</strong>
                          </div>
                        }
                      </div>
                    }
                    @if (response.asOfUtc) {
                      <small class="as-of">Checked {{ response.asOfUtc | localDatetime:'datetime' }} IST</small>
                    }
                  }
                  @if (response.matches?.length) {
                    <div class="match-list">
                      @for (match of response.matches; track match.studentId) {
                        <button type="button" class="match-option" (click)="selectStudent(match, message.question || '')">
                          <strong>{{ match.studentName }}</strong>
                          <span>
                            {{ match.rollNumber }}
                            @if (match.className || match.batchName) {
                              · {{ match.className || match.batchName }}
                            }
                          </span>
                        </button>
                      }
                    </div>
                  }
                }
                @if (message.dueSlipPrompt; as dueSlip) {
                  <div class="due-slip-prompt">
                    <button type="button" matButton="outlined" (click)="respondToDueSlip(false, dueSlip)">
                      No, thanks
                    </button>
                    <button type="button" matButton="filled" color="primary" (click)="respondToDueSlip(true, dueSlip)">
                      <mat-icon>download</mat-icon>
                      Yes, download
                    </button>
                  </div>
                }
                @if (message.dueSlipDownload; as dueSlip) {
                  <button type="button" class="due-slip-download" matButton="filled" (click)="openDueSlip(dueSlip)">
                    <mat-icon>receipt_long</mat-icon>
                    Open &amp; download Fee Due Slip
                  </button>
                }
                @if (message.sender === 'assistant' && speechSynthesisSupported) {
                  <button
                    type="button"
                    class="replay-button"
                    mat-icon-button
                    (click)="replayMessage(message)"
                    [attr.aria-label]="voiceLanguage === 'hi-IN' ? 'हिंदी में जवाब फिर से सुनें' : 'Replay response'"
                    [title]="voiceLanguage === 'hi-IN' ? 'हिंदी में फिर से सुनें' : 'Replay response'">
                    <mat-icon>volume_up</mat-icon>
                  </button>
                }
              </div>
            </div>
          }
          @if (loading) {
            <div class="loading-row">
              <mat-spinner diameter="22"></mat-spinner>
              <span>Checking verified ERP records…</span>
            </div>
          }
        </div>
        <p class="scope-note">
          Includes unpaid billed charges and pending library fines. Transport or hostel rates are not counted unless billed.
        </p>
      </div>

      <form class="question-form" [formGroup]="questionForm" (ngSubmit)="submitQuestion()">
        <input
          formControlName="question"
          type="text"
          maxlength="200"
          placeholder="Student ka naam likhein, jaise Amar"
          aria-label="Ask about student dues">
        <button
          type="button"
          class="voice-language-button"
          [disabled]="isListening"
          (click)="toggleVoiceLanguage()"
          [attr.aria-label]="'Voice recognition language: ' + (voiceLanguage === 'en-IN' ? 'English India' : 'Hindi India') + '. Click to switch.'"
          [title]="'Voice language: ' + (voiceLanguage === 'en-IN' ? 'English (India)' : 'Hindi')">
          {{ voiceLanguage === 'en-IN' ? 'EN' : 'HI' }}
        </button>
        <button
          type="button"
          class="hands-free-button"
          [class.active]="handsFreeMode"
          [disabled]="loading || !handsFreeVoiceSupported"
          [attr.aria-label]="handsFreeMode ? 'Turn off hands-free voice conversation' : 'Turn on hands-free voice conversation'"
          [title]="handsFreeMode ? 'Hands-free is on. Click to stop continuous listening.' : 'Hands-free: keep listening after each response.'"
          (click)="toggleHandsFreeMode()">
          <mat-icon>{{ handsFreeMode ? 'record_voice_over' : 'voice_over_off' }}</mat-icon>
          <span>Hands-free</span>
        </button>
        <button
          type="button"
          class="voice-button"
          [class.listening]="isListening"
          [disabled]="loading || !speechRecognitionSupported"
          [attr.aria-label]="isListening ? 'Stop voice input' : 'Start voice input'"
          [attr.title]="speechRecognitionSupported ? (isListening ? 'Stop listening' : 'Ask by voice') : 'Voice input is not supported in this browser'"
          (click)="toggleVoiceInput()">
          <mat-icon>{{ isListening ? 'mic_off' : 'mic' }}</mat-icon>
        </button>
        <button type="submit" mat-icon-button color="primary" [disabled]="loading || questionForm.controls.question.invalid" aria-label="Ask">
          <mat-icon>send</mat-icon>
        </button>
      </form>
      @if (!speechRecognitionSupported) {
        <p class="voice-status voice-error" aria-live="polite">
          Voice input is not supported in this browser. You can type your question instead.
        </p>
      } @else if (voiceStatus) {
        <p class="voice-status" [class.voice-error]="voiceError" aria-live="polite">{{ voiceStatus }}</p>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .assistant-dialog {
      display: flex;
      height: 100%;
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
      background: #ffffff;
    }

    .assistant-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      flex-shrink: 0;
    }

    .assistant-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      flex: 0 0 42px;
      color: #ffffff;
      background: #2563eb;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .assistant-heading {
      min-width: 0;
      flex: 1;
    }

    .assistant-heading h2 {
      margin: 0;
      color: #1e3a8a;
      font-size: 1rem;
      font-weight: 700;
    }

    .assistant-heading p {
      margin: 3px 0 0;
      color: #3b82f6;
      font-size: 0.78rem;
    }

    .close-button {
      flex: 0 0 auto;
      color: #64748b;
    }

    .close-button:hover {
      color: #1e293b;
    }

    .assistant-content {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 0;
      padding: 16px 18px 8px;
      overflow: auto;
    }

    .messages {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      gap: 12px;
    }

    .message-row {
      display: flex;
      justify-content: flex-start;
    }

    .user-row {
      justify-content: flex-end;
    }

    .message-bubble {
      max-width: 88%;
      padding: 11px 13px;
      color: #334155;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 14px 14px 14px 4px;
      font-size: 0.86rem;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }

    .user-bubble {
      color: #ffffff;
      background: #2563eb;
      border-color: #2563eb;
      border-radius: 14px 14px 4px 14px;
    }

    .due-total,
    .breakdown-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .due-total {
      margin-top: 12px;
      padding: 10px 0;
      border-top: 1px solid #bfdbfe;
      color: #1e3a8a;
    }

    .due-total strong {
      font-size: 1.05rem;
      white-space: nowrap;
    }

    .due-breakdown {
      display: grid;
      gap: 7px;
    }

    .period-breakdown {
      display: grid;
      gap: 7px;
      margin: 0 0 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #dbeafe;
    }

    .period-heading {
      color: #1e3a8a;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .breakdown-row {
      color: #475569;
      font-size: 0.8rem;
    }

    .breakdown-row strong {
      color: #1e293b;
      white-space: nowrap;
    }

    .as-of {
      display: block;
      margin-top: 10px;
      color: #64748b;
      font-size: 0.7rem;
    }

    .match-list {
      display: grid;
      gap: 6px;
      margin-top: 10px;
    }

    .match-option {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 10px;
      color: #1e3a8a;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
    }

    .match-option:hover {
      background: #eff6ff;
    }

    .match-option span {
      color: #64748b;
      font-size: 0.72rem;
    }

    .due-slip-prompt {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .due-slip-download {
      margin-top: 10px;
      color: #ffffff !important;
      background: #2563eb !important;
    }

    .replay-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 32px !important;
      min-width: 32px !important;
      height: 32px !important;
      min-height: 32px !important;
      padding: 0 !important;
      margin: 6px 0 -7px auto;
      color: #2563eb;
      border-radius: 999px;
      --mdc-icon-button-state-layer-size: 32px;
    }

    .replay-button:hover {
      background: #dbeafe;
    }

    .replay-button mat-icon {
      display: block;
      margin: 0;
    }

    .loading-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      color: #64748b;
      font-size: 0.78rem;
    }

    .scope-note {
      margin: 12px 0 4px;
      color: #64748b;
      font-size: 0.7rem;
      line-height: 1.4;
    }

    .question-form {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .voice-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      flex: 0 0 40px;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 50%;
      cursor: pointer;
    }

    .hands-free-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: auto;
      height: 36px;
      flex: 0 0 auto;
      padding: 0 8px;
      color: #64748b;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 50%;
      cursor: pointer;
    }

    .hands-free-button span {
      font-size: 0.68rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .hands-free-button.active {
      color: #ffffff;
      background: #2563eb;
      border-color: #2563eb;
    }

    .hands-free-button:hover:not(:disabled) {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .hands-free-button.active:hover:not(:disabled) {
      color: #ffffff;
      background: #1d4ed8;
    }

    .hands-free-button:disabled {
      color: #94a3b8;
      background: #f1f5f9;
      border-color: #e2e8f0;
      cursor: not-allowed;
    }

    .voice-button:hover:not(:disabled) {
      background: #dbeafe;
    }

    .voice-button.listening {
      color: #ffffff;
      background: #dc2626;
      border-color: #dc2626;
      animation: voice-pulse 1.2s ease-in-out infinite;
    }

    .voice-button:disabled {
      color: #94a3b8;
      background: #f1f5f9;
      border-color: #e2e8f0;
      cursor: not-allowed;
    }

    .voice-status {
      margin: 0;
      padding: 0 16px 8px;
      color: #2563eb;
      font-size: 0.72rem;
    }

    .voice-status.voice-error {
      color: #b91c1c;
    }

    @keyframes voice-pulse {
      50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.16); }
    }

    .question-form input {
      flex: 1;
      min-width: 0;
      padding: 11px 13px;
      border: 1px solid #cbd5e1;
      border-radius: 999px;
      color: #1e293b;
      font: inherit;
      outline: none;
    }

    .question-form input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
    }

    @media (max-width: 520px) {
      .assistant-header {
        padding: 13px 14px;
      }

      .assistant-content {
        padding: 12px 12px 6px;
      }

      .message-bubble {
        max-width: 94%;
      }

      .question-form {
        padding: 8px 10px;
      }
    }
  `]
})
export class StudentDuesAssistantComponent implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);

  @Output() readonly closeRequested = new EventEmitter<void>();

  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;

  readonly questionForm = new FormGroup({
    question: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)]
    })
  });
  messages: AssistantMessage[] = [{
    sender: 'assistant',
    text: 'Namaste! Student ka naam likhkar uske verified dues poochhein.'
  }];
  loading = false;
  isListening = false;
  voiceStatus = 'Tap the microphone and speak a student name. EN works best for Hinglish names.';
  voiceError = false;
  voiceLanguage: 'en-IN' | 'hi-IN' = this.getSavedVoiceLanguage();
  handsFreeMode = false;
  private pendingDueSlip?: DueSlipStudent;
  private speechRecognition?: SpeechRecognitionLike;
  private voiceTurnProcessing = false;
  private silenceRetryPending = false;
  private destroyed = false;

  get speechRecognitionSupported(): boolean {
    return typeof window !== 'undefined' &&
      !!(window as WindowWithSpeechRecognition).SpeechRecognition ||
      typeof window !== 'undefined' &&
      !!(window as WindowWithSpeechRecognition).webkitSpeechRecognition;
  }

  get speechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get handsFreeVoiceSupported(): boolean {
    return this.speechRecognitionSupported && this.speechSynthesisSupported;
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.handsFreeMode = false;
    this.stopVoiceRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  closeAssistant(): void {
    this.handsFreeMode = false;
    this.voiceTurnProcessing = false;
    this.silenceRetryPending = false;
    this.stopVoiceRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.closeRequested.emit();
  }

  toggleVoiceLanguage(): void {
    if (this.isListening) {
      return;
    }

    this.voiceLanguage = this.voiceLanguage === 'en-IN' ? 'hi-IN' : 'en-IN';
    if (typeof window !== 'undefined') {
      localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, this.voiceLanguage);
    }
    this.voiceStatus = this.voiceLanguage === 'en-IN'
      ? 'Voice language set to English (India). This works best for Hinglish student names.'
      : 'Voice language set to Hindi. Use EN for student names stored in English.';
    this.voiceError = false;
  }

  private getSavedVoiceLanguage(): 'en-IN' | 'hi-IN' {
    if (typeof window === 'undefined') {
      return 'en-IN';
    }

    return localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY) === 'hi-IN' ? 'hi-IN' : 'en-IN';
  }

  toggleVoiceInput(): void {
    if (this.isListening) {
      this.handsFreeMode = false;
      this.stopVoiceRecognition();
      this.voiceStatus = 'Voice input stopped.';
      this.voiceError = false;
      return;
    }

    if (this.loading) {
      return;
    }

    this.startVoiceRecognition();
  }

  toggleHandsFreeMode(): void {
    if (this.handsFreeMode) {
      this.handsFreeMode = false;
      this.voiceTurnProcessing = false;
      this.stopVoiceRecognition();
      if (this.speechSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
      this.voiceStatus = 'Hands-free conversation stopped.';
      this.voiceError = false;
      return;
    }

    if (this.loading || !this.handsFreeVoiceSupported) {
      return;
    }

    this.handsFreeMode = true;
    this.voiceTurnProcessing = false;
    this.silenceRetryPending = false;
    this.voiceError = false;
    this.startVoiceRecognition();
  }

  private startVoiceRecognition(): void {
    if (this.destroyed || this.isListening || this.loading) {
      return;
    }

    const speechWindow = window as WindowWithSpeechRecognition;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      this.voiceStatus = 'Voice input is not supported in this browser. You can type your question instead.';
      this.voiceError = true;
      return;
    }

    const recognition = new Recognition();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.speechRecognition = recognition;
    recognition.lang = this.voiceLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.onresult = event => {
      const transcripts = Array.from(event.results)
        .filter(result => result.isFinal)
        .flatMap(result => Array.from(result).map(alternative => alternative.transcript.trim()))
        .filter(Boolean);
      const transcript = (this.handsFreeMode
        ? transcripts.find(candidate => this.isHandsFreeStopCommand(candidate))
        : undefined) || transcripts[0] || '';
      if (transcript) {
        this.silenceRetryPending = false;
        this.voiceStatus = `Heard: “${transcript}”`;
        this.voiceError = false;
        this.voiceTurnProcessing = true;
        this.handleVoiceTranscript(transcript);
      }
    };
    recognition.onerror = event => {
      if (this.destroyed) {
        return;
      }
      if (event.error === 'no-speech' && this.handsFreeMode) {
        this.silenceRetryPending = true;
        this.voiceError = false;
        this.voiceTurnProcessing = false;
        this.voiceStatus = this.voiceLanguage === 'hi-IN'
          ? 'कोई आवाज़ नहीं सुनाई दी। Hands-free चालू है—बोलिए, मैं सुन रहा हूँ।'
          : 'No speech detected. Hands-free is still on—speak when ready.';
        this.changeDetector.markForCheck();
        return;
      }

      this.voiceError = true;
      this.voiceTurnProcessing = false;
      this.handsFreeMode = false;
      this.silenceRetryPending = false;
      this.voiceStatus = this.getSpeechErrorMessage(event.error);
      this.changeDetector.markForCheck();
    };
    recognition.onend = () => {
      if (this.speechRecognition === recognition) {
        this.speechRecognition = undefined;
      }
      if (!this.destroyed) {
        this.isListening = false;
        if (!this.voiceStatus) {
          this.voiceStatus = 'Voice input ended. Tap the microphone to try again.';
        }
        if (this.handsFreeMode && !this.voiceTurnProcessing && !this.voiceError) {
          window.setTimeout(() => {
            if (this.handsFreeMode) {
              this.startVoiceRecognition();
            }
          }, 600);
        }
        this.changeDetector.markForCheck();
      }
    };

    const listeningStatus = this.voiceLanguage === 'en-IN'
      ? 'Listening in English (India)… Say the student name and your question.'
      : 'Listening in Hindi… Speak now.';
    this.voiceStatus = this.silenceRetryPending
      ? this.voiceLanguage === 'hi-IN'
        ? 'कोई आवाज़ नहीं सुनाई दी। Hands-free चालू है—बोलिए, मैं सुन रहा हूँ।'
        : 'No speech detected. Hands-free is still on—speak when ready.'
      : this.handsFreeMode
      ? this.voiceLanguage === 'hi-IN'
        ? `Hands-free बातचीत चालू है। ${listeningStatus} रोकने के लिए “बस” या “रुक जाइए” कहें।`
        : `Hands-free conversation active. ${listeningStatus} Say “stop” to end.`
      : listeningStatus;
    this.voiceError = false;
    this.isListening = true;
    try {
      recognition.start();
    } catch (error) {
      this.isListening = false;
      this.speechRecognition = undefined;
      this.handsFreeMode = false;
      this.voiceTurnProcessing = false;
      this.voiceStatus = 'Could not start voice input. Check microphone permission and try again.';
      this.voiceError = true;
      console.error('Failed to start student dues voice input.', error);
    }
  }

  private stopVoiceRecognition(): void {
    const recognition = this.speechRecognition;
    this.speechRecognition = undefined;
    this.isListening = false;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    }
  }

  private handleVoiceTranscript(transcript: string): void {
    if (this.handsFreeMode && this.isHandsFreeStopCommand(transcript)) {
      this.handsFreeMode = false;
      this.voiceTurnProcessing = false;
      this.stopVoiceRecognition();
      if (this.speechSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
      this.voiceStatus = 'Hands-free conversation stopped.';
      this.voiceError = false;
      this.changeDetector.markForCheck();
      return;
    }

    if (this.handsFreeMode && this.isRepeatCommand(transcript)) {
      const lastAssistantMessage = [...this.messages]
        .reverse()
        .find(message => message.sender === 'assistant');
      if (lastAssistantMessage) {
        this.voiceStatus = 'Repeating the last response.';
        this.replayMessage(lastAssistantMessage);
        this.changeDetector.markForCheck();
        return;
      }
    }

    const clarification = [...this.messages]
      .reverse()
      .find(message => message.response?.matches?.length);
    const matches = clarification?.response?.matches;
    if (matches?.length) {
      const selectedMatch = this.findVoiceMatch(transcript, matches);
      if (!selectedMatch) {
        const prompt = this.voiceLanguage === 'hi-IN'
          ? `मैंने “${transcript}” सुना, लेकिन छात्र की पहचान नहीं कर पाया। कृपया उनका रोल नंबर, कक्षा या बैच बताइए।`
          : `I heard “${transcript}”, but couldn't identify the student. Please say their roll number, class, or batch.`;
        this.voiceStatus = prompt;
        this.speak(prompt);
        this.changeDetector.markForCheck();
        return;
      }
      this.selectStudent(selectedMatch, clarification?.question || transcript);
      return;
    }

    this.questionForm.controls.question.setValue(transcript);
    this.submitQuestion();
  }

  private isHandsFreeStopCommand(transcript: string): boolean {
    const command = this.normalizeVoiceText(transcript);
    return /^(?:(?:ठीक है|अच्छा|ओके|okay|please|प्लीज|अब) )*(?:stop(?: listening| conversation)?|cancel|बस+|bas+|bus+|रुक|रुको|रुकिए|रुक जाइए|रुक जाओ|रोक|रोकिए|रोक दो|बंद|सुनना बंद|स्टॉप)(?: अब)?(?: (?:करो|करिए|करिये|कर दो|कर दीजिए|कर दीजिये|कीजिए|कीजिये|बंद करो|बंद कर दो|बंद कर दीजिए|बंद कर दीजिये|बंद))?(?: (?:अब|please|प्लीज))*$/u.test(command);
  }

  private isRepeatCommand(transcript: string): boolean {
    const command = this.normalizeVoiceText(transcript);
    return /^(?:repeat|repeat that|say again|say that again|again|फिर से बोलो|फिर से बोलिए|दोबारा बोलो|दोबारा बताओ|फिर से सुनाओ|फिर बताइए)$/.test(command);
  }

  private findVoiceMatch(transcript: string, matches: DuesAssistantMatch[]): DuesAssistantMatch | undefined {
    const normalizedTranscript = this.normalizeVoiceText(transcript);
    const ordinalIndex = this.getOrdinalChoice(normalizedTranscript);
    if (ordinalIndex !== undefined) {
      return matches[ordinalIndex];
    }

    const normalizedRoll = normalizedTranscript.replace(/[^a-z0-9]/g, '');
    const rollMatches = matches.filter(match => {
      const roll = this.normalizeVoiceText(match.rollNumber).replace(/[^a-z0-9]/g, '');
      return roll.length > 0 && normalizedRoll.includes(roll);
    });
    if (rollMatches.length === 1) {
      return rollMatches[0];
    }

    const detailMatches = matches.filter(match => {
      const details = [match.className, match.batchName]
        .filter((value): value is string => !!value)
        .map(value => this.normalizeVoiceText(value))
        .filter(value => value.length >= 3);
      return details.some(detail => normalizedTranscript.includes(detail));
    });
    if (detailMatches.length === 1) {
      return detailMatches[0];
    }

    const exactNameMatches = matches.filter(match =>
      this.normalizeVoiceText(match.studentName) === normalizedTranscript
    );
    if (exactNameMatches.length === 1) {
      return exactNameMatches[0];
    }

    return undefined;
  }

  private getOrdinalChoice(transcript: string): number | undefined {
    const choice = transcript
      .replace(/^(?:the |option |student |match |number |विकल्प |छात्र |नंबर )/u, '')
      .replace(/(?: one| student| option| match| वाला| वाली| वाले| छात्र| विद्यार्थी)$/u, '');
    const choices: Record<string, number> = {
      first: 0,
      one: 0,
      '1': 0,
      पहला: 0,
      पहली: 0,
      पहले: 0,
      एक: 0,
      second: 1,
      two: 1,
      '2': 1,
      दूसरा: 1,
      दूसरी: 1,
      दूसरे: 1,
      दो: 1,
      third: 2,
      three: 2,
      '3': 2,
      तीसरा: 2,
      तीसरी: 2,
      तीसरे: 2,
      तीन: 2,
      fourth: 3,
      four: 3,
      '4': 3,
      चौथा: 3,
      चौथी: 3,
      चौथे: 3,
      चार: 3
    };
    return choices[choice];
  }

  private normalizeVoiceText(value: string): string {
    return value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }

  private getSpeechErrorMessage(error: string): string {
    switch (error) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Microphone access was denied. Allow microphone permission in your browser settings and try again.';
      case 'audio-capture':
        return 'No microphone was found. Connect a microphone or headset and try again.';
      case 'no-speech':
        return 'No speech was detected. Tap the microphone and speak clearly.';
      case 'network':
        return 'Voice recognition needs an internet connection. Check your connection and try again.';
      case 'aborted':
        return 'Voice input stopped.';
      default:
        return 'Voice input failed. Check microphone permission and try again.';
    }
  }

  private speak(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.voiceLanguage;
    utterance.onend = () => {
      if (this.handsFreeMode && !this.destroyed) {
        this.voiceTurnProcessing = false;
        this.startVoiceRecognition();
      }
    };
    utterance.onerror = () => {
      if (this.handsFreeMode && !this.destroyed) {
        this.handsFreeMode = false;
        this.voiceTurnProcessing = false;
        this.voiceStatus = 'Hands-free conversation stopped because speech could not be played.';
        this.voiceError = true;
        this.changeDetector.markForCheck();
      }
    };
    const voices = window.speechSynthesis.getVoices();
    const language = this.voiceLanguage.toLowerCase();
    utterance.voice = voices.find(voice => voice.lang.toLowerCase() === language) ||
      voices.find(voice => voice.lang.toLowerCase().startsWith(language.slice(0, 2) + '-')) ||
      null;
    window.speechSynthesis.speak(utterance);
  }

  replayMessage(message: AssistantMessage): void {
    if (message.sender !== 'assistant') {
      return;
    }

    let speechText = message.speechText;
    if (!speechText && message.response) {
      speechText = this.getResponseSpeech(message.response);
    } else if (!speechText && message.dueSlipPrompt) {
      speechText = this.getDueSlipPromptSpeech(message.dueSlipPrompt.studentName);
    } else if (!speechText && message.dueSlipDownload) {
      speechText = this.voiceLanguage === 'hi-IN'
        ? `${message.dueSlipDownload.studentName} की फीस की आधिकारिक रसीद तैयार है। इसे खोलकर डाउनलोड या प्रिंट कर सकते हैं।`
        : message.text;
    } else if (!speechText && message.text.startsWith('Namaste!')) {
      speechText = this.voiceLanguage === 'hi-IN'
        ? 'नमस्ते! छात्र का नाम बताइए, मैं उनकी बकाया फीस की जानकारी दूँगा।'
        : message.text;
    } else {
      speechText ||= message.text;
    }

    this.speak(speechText);
  }

  private getResponseSpeech(response: DuesAssistantResponse): string {
    if (this.voiceLanguage === 'hi-IN') {
      return this.getHindiResponseSpeech(response);
    }

    if (response.status === 'answer') {
      const name = response.studentName || 'The student';
      const total = response.totalDue || 0;
      const periods = response.periods?.length
        ? ` Unpaid billed fees: ${response.periods.map(period => `${period.period}, ${period.amount} rupees`).join('; ')}.`
        : '';
      return `${name}'s total outstanding dues are ${total} rupees.${periods}`;
    }

    if (response.status === 'clarification' && response.matches?.length) {
      const options = response.matches.map((match, index) => {
        const details = [match.rollNumber, match.className, match.batchName]
          .filter((value): value is string => !!value)
          .join(', ');
        return `Option ${index + 1}: ${match.studentName}, ${details}.`;
      }).join(' ');
      return `More than one student matched. Please say the student's roll number, class or batch, or say first or second. ${options}`;
    }

    if (response.status === 'notFound') {
      return 'I could not find a matching student. Please try their full name or roll number.';
    }

    if (response.status === 'clarification') {
      return 'Which student do you mean? Please say their full name or roll number.';
    }

    return response.reply;
  }

  private getHindiResponseSpeech(response: DuesAssistantResponse): string {
    if (response.status === 'answer') {
      const name = response.studentName || 'छात्र';
      const total = this.formatHindiAmount(response.totalDue || 0);
      const periods = response.periods?.length
        ? ` बकाया फीस: ${response.periods.map(period =>
          `${this.getHindiPeriod(period.period)}, ${this.formatHindiAmount(period.amount)} रुपये`
        ).join('; ')}।`
        : '';
      return `${name} का कुल बकाया ${total} रुपये है।${periods}`;
    }

    if (response.status === 'clarification' && response.matches?.length) {
      const options = response.matches.map((match, index) => {
        const details = [match.rollNumber, match.className, match.batchName]
          .filter((value): value is string => !!value)
          .join(', ');
        return `विकल्प ${this.toHindiDigits(index + 1)}: ${match.studentName}, ${details}।`;
      }).join(' ');
      return `एक से अधिक छात्रों के नाम मिले हैं। कृपया सही छात्र चुनने के लिए उनका रोल नंबर, कक्षा या बैच बताइए, या पहला, दूसरा अथवा तीसरा विकल्प बोलिए। ${options}`;
    }

    if (response.status === 'notFound') {
      return 'इस नाम से कोई छात्र नहीं मिला। कृपया उनका पूरा नाम या रोल नंबर बोलकर फिर से कोशिश करें।';
    }

    if (response.status === 'clarification') {
      return 'आप किस छात्र के बारे में पूछ रहे हैं? कृपया उनका पूरा नाम या रोल नंबर बताइए।';
    }

    return 'माफ़ कीजिए, अभी जवाब नहीं मिल पाया। कृपया फिर से कोशिश करें।';
  }

  private formatHindiAmount(amount: number): string {
    return this.toHindiDigits(new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2
    }).format(amount));
  }

  private toHindiDigits(value: string | number): string {
    return String(value).replace(/\d/g, digit => '०१२३४५६७८९'[Number(digit)]);
  }

  private getHindiPeriod(period: string): string {
    const monthNames: Record<string, string> = {
      january: 'जनवरी',
      february: 'फ़रवरी',
      march: 'मार्च',
      april: 'अप्रैल',
      may: 'मई',
      june: 'जून',
      july: 'जुलाई',
      august: 'अगस्त',
      september: 'सितंबर',
      october: 'अक्टूबर',
      november: 'नवंबर',
      december: 'दिसंबर'
    };

    return period.replace(
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/gi,
      month => monthNames[month.toLowerCase()] || month
    );
  }

  private getDueSlipPromptSpeech(studentName: string): string {
    return this.voiceLanguage === 'hi-IN'
      ? `क्या आप ${studentName} की फीस की आधिकारिक रसीद डाउनलोड करना चाहेंगे?`
      : `Would you like to download ${studentName}'s official Fee Due Slip?`;
  }

  submitQuestion(): void {
    const question = this.questionForm.controls.question.value.trim();
    if (!question || this.loading) {
      return;
    }

    this.questionForm.controls.question.setValue('');
    if (this.pendingDueSlip && this.isAffirmative(question)) {
      this.respondToDueSlip(true, this.pendingDueSlip, question);
      return;
    }

    if (this.pendingDueSlip && this.isNegative(question)) {
      this.respondToDueSlip(false, this.pendingDueSlip, question);
      return;
    }

    this.pendingDueSlip = undefined;
    this.ask(question);
  }

  selectStudent(match: DuesAssistantMatch, question: string): void {
    if (this.loading) {
      return;
    }

    this.messages.push({
      sender: 'user',
      text: `${match.studentName} (${match.rollNumber})`
    });
    this.pendingDueSlip = undefined;
    this.ask(question, match.studentId);
  }

  respondToDueSlip(download: boolean, student = this.pendingDueSlip, userReply?: string): void {
    if (!student) {
      return;
    }

    this.messages.push({
      sender: 'user',
      text: userReply || (download ? 'Yes, download' : 'No, thanks')
    });
    if (this.pendingDueSlip?.studentId === student.studentId) {
      this.pendingDueSlip = undefined;
    }

    if (download) {
      const confirmation = {
        sender: 'assistant',
        text: `Here is ${student.studentName}'s official Fee Due Slip. Open it to download or print the PDF.`,
        speechText: this.voiceLanguage === 'hi-IN'
          ? `${student.studentName} की फीस की आधिकारिक रसीद तैयार है। इसे खोलकर डाउनलोड या प्रिंट कर सकते हैं।`
          : undefined,
        dueSlipDownload: student
      } satisfies AssistantMessage;
      this.messages.push(confirmation);
      this.speak(confirmation.speechText || confirmation.text);
    } else {
      const confirmation = {
        sender: 'assistant',
        text: 'No problem. You can ask for it whenever you need it.',
        speechText: this.voiceLanguage === 'hi-IN'
          ? 'ठीक है। ज़रूरत होने पर आप कभी भी रसीद माँग सकते हैं।'
          : undefined
      } satisfies AssistantMessage;
      this.messages.push(confirmation);
      this.speak(confirmation.speechText || confirmation.text);
    }
    this.changeDetector.markForCheck();
    this.scrollToLatest();
  }

  async openDueSlip(student: DueSlipStudent): Promise<void> {
    try {
      const { FeeDueReceiptDialogComponent } = await import('../../features/fees/fee-due-receipt-dialog.component');
      this.dialog.open(FeeDueReceiptDialogComponent, {
        width: '840px',
        maxWidth: '96vw',
        maxHeight: '94vh',
        panelClass: 'receipt-dialog-panel',
        data: {
          studentId: student.studentId,
          studentName: student.studentName,
          rollNumber: student.rollNumber,
          batchName: student.batchName
        }
      });
    } catch (error) {
      console.error('Failed to load the Fee Due Slip dialog.', error);
      this.confirmDialog.alert(
        'Download unavailable',
        'The Fee Due Slip could not be opened. Please try again.',
        'warning'
      );
    }
  }

  private ask(question: string, studentId?: string): void {
    if (!studentId) {
      this.messages.push({ sender: 'user', text: question });
    }

    this.loading = true;
    this.changeDetector.markForCheck();
    this.http.post<DuesAssistantResponse>(`${environment.apiUrl}/student-dues-assistant/ask`, {
      question,
      studentId: studentId || null
    }).pipe(timeout({ first: 20000 })).subscribe({
      next: response => {
        this.loading = false;
        this.messages.push({
          sender: 'assistant',
          text: response.reply,
          speechText: this.getResponseSpeech(response),
          question,
          response
        });
        const resolvedStudentId = response.studentId || studentId;
        if (response.status === 'answer' && resolvedStudentId) {
          this.pendingDueSlip = {
            studentId: resolvedStudentId,
            studentName: response.studentName || 'student',
            rollNumber: response.rollNumber,
            className: response.className,
            batchName: response.batchName
          };
          this.messages.push({
            sender: 'assistant',
            text: `Would you like to download ${this.pendingDueSlip.studentName}'s official Fee Due Slip?`,
            speechText: this.getDueSlipPromptSpeech(this.pendingDueSlip.studentName),
            dueSlipPrompt: this.pendingDueSlip
          });
        }
        const responseSpeech = this.getResponseSpeech(response);
        this.speak(responseSpeech +
          (response.status === 'answer' && resolvedStudentId
            ? ` ${this.getDueSlipPromptSpeech(this.pendingDueSlip?.studentName || 'the student')}`
            : ''));
        this.changeDetector.markForCheck();
        this.scrollToLatest();
      },
      error: error => {
        this.loading = false;
        const errorMessage = error instanceof TimeoutError
          ? 'The dues check is taking longer than expected. Please try again.'
          : error.error?.message || 'Could not check the dues. Please try again shortly.';
        const errorSpeech = this.voiceLanguage === 'hi-IN'
          ? error instanceof TimeoutError
            ? 'बकाया राशि जाँचने में समय लग रहा है। कृपया फिर से कोशिश करें।'
            : 'बकाया राशि की जाँच नहीं हो पाई। कृपया थोड़ी देर बाद फिर से कोशिश करें।'
          : errorMessage;
        this.messages.push({
          sender: 'assistant',
          text: errorMessage,
          speechText: errorSpeech
        });
        this.speak(errorSpeech);
        this.changeDetector.markForCheck();
        this.scrollToLatest();
      }
    });
  }

  private isAffirmative(answer: string): boolean {
    return /^\s*(?:yes|y|sure|certainly|absolutely|haan|haa|han)\b/i.test(answer) ||
      /^\s*(?:download|please)\b/i.test(answer) ||
      /^\s*(?:हाँ|हां|जी)(?:$|[\s.!])/u.test(answer);
  }

  private isNegative(answer: string): boolean {
    return /^\s*(?:no|not\s+now|no\s+thanks|nahi|nahin|nhi)\b/i.test(answer) ||
      /^\s*(?:नहीं|नही)(?:$|[\s.!])/u.test(answer);
  }

  private scrollToLatest(): void {
    setTimeout(() => {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }
}
