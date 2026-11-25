import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

export interface CoachingAiPaperDialogData {
  testId: string;
  title: string;
  subject: string;
  batchName?: string;
  className?: string;
  maxMarks: number;
  testDate?: string;
  canCreate: boolean;
  canEdit: boolean;
}

export interface AiExamQuestion {
  qNo: number;
  section: string;
  type: 'MCQ' | 'FillInBlank' | 'ShortAnswer' | 'LongAnswer' | string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  topic: string;
  marks: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  markingScheme: string;
}

interface UploadedChapterFile {
  fileName: string;
  mimeType: string;
  sizeKb: number;
  base64Data: string;
}

@Component({
  selector: 'app-coaching-ai-paper-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatChipsModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ai-paper-dialog">
      <!-- Strict Light-Blue Gradient ERP Dialog Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>auto_awesome</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 class="dialog-title">Agentic AI Question Paper Studio</h2>
              @if (paperId) {
                <span class="status-pill" [ngClass]="'status-' + (paperStatus || 'Draft').toLowerCase()">
                  {{ formatPaperStatus(paperStatus) }}
                </span>
              }
            </div>
            <p class="dialog-subtitle">
              Test: <strong>{{ data.title }}</strong>
              &bull; Subject: <strong>{{ data.subject || 'General' }}</strong>
              @if (data.batchName) { &bull; Batch: <strong>{{ data.batchName }}</strong> }
              &bull; Max Marks: <strong>{{ computedPaperMarks || data.maxMarks }}</strong>
            </p>
          </div>
        </div>

        <div class="header-right">
          @if (aiConfig.canConfigure) {
            <button
              type="button"
              mat-stroked-button
              class="ai-key-btn"
              [class.configured]="aiConfig.isConfigured"
              (click)="showAiKeyPanel = !showAiKeyPanel"
              matTooltip="Configure free Gemini API key for Agentic AI question generation">
              <mat-icon>{{ aiConfig.isConfigured ? 'verified_user' : 'vpn_key' }}</mat-icon>
              <span>{{ aiConfig.isConfigured ? 'Gemini Connected' : 'Setup Gemini Key' }}</span>
            </button>
          }
          <button type="button" mat-icon-button class="close-btn" [disabled]="loading" (click)="close()" [matTooltip]="loading ? 'Please wait until AI completes...' : 'Close'">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Single Prominent AI Processing Overlay Loader (AGENTS.md Strict Single Loader Rule) -->
      @if (loading) {
        <div class="ai-processing-overlay">
          <div class="ai-processing-card">
            <mat-spinner diameter="44"></mat-spinner>
            <div class="ai-proc-title">{{ loadingMessage || 'Processing with Agentic AI...' }}</div>
            <div class="ai-proc-sub">Please wait — do not close this window while Gemini AI prepares &amp; verifies your paper.</div>
          </div>
        </div>
      }

      <!-- Collapsible Secure Gemini API Key Configuration Panel -->
      @if (showAiKeyPanel && aiConfig.canConfigure) {
        <div class="ai-key-panel">
          <form [formGroup]="aiConfigForm" class="ai-key-form" (ngSubmit)="saveAiConfig()">
            <div class="ai-key-info">
              <mat-icon>auto_awesome</mat-icon>
              <div>
                <strong>Gemini AI Provider Setup (Free Tier Supported)</strong>
                <p>
                  Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.
                  @if (aiConfig.isConfigured) {
                    Current Key: <code>{{ aiConfig.maskedKey }}</code> ({{ aiConfig.source }})
                  }
                </p>
              </div>
            </div>
            <div class="ai-key-inputs">
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="key-field">
                <mat-label>Gemini API Key</mat-label>
                <input matInput type="password" formControlName="apiKey" placeholder="Paste AIzaSy... key here" autocomplete="off" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="model-field">
                <mat-label>Gemini Model</mat-label>
                <mat-select formControlName="modelName">
                  <mat-option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</mat-option>
                  <mat-option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite (Fast Free)</mat-option>
                  <mat-option value="gemini-flash-latest">gemini-flash-latest (Auto Latest)</mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-flat-button color="primary" type="submit" [disabled]="loading">
                <mat-icon>save</mat-icon> Save Key
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Mode Tabs -->
      <div class="studio-tabs">
        <button type="button" class="studio-tab" [class.active]="activeTab === 'source'" (click)="activeTab = 'source'">
          <mat-icon>upload_file</mat-icon>
          <span>1. Chapter &amp; Blueprint</span>
        </button>
        <button type="button" class="studio-tab" [class.active]="activeTab === 'editor'" [disabled]="questions.length === 0" (click)="activeTab = 'editor'">
          <mat-icon>edit_note</mat-icon>
          <span>2. Review, Edit &amp; Approval ({{ questions.length }})</span>
        </button>
        <button type="button" class="studio-tab" [class.active]="activeTab === 'print'" [disabled]="questions.length === 0" (click)="activeTab = 'print'">
          <mat-icon>print</mat-icon>
          <span>3. Print Paper (Set A/B/C) &amp; Answer Key</span>
        </button>
      </div>

      <!-- Dialog Body -->
      <mat-dialog-content class="dialog-body">
        <!-- TAB 1: CHAPTER SOURCE & BLUEPRINT -->
        @if (activeTab === 'source') {
          <form [formGroup]="generatorForm" class="source-layout">
            @if (isPaperLocked) {
              <div class="locked-banner">
                <mat-icon>lock</mat-icon>
                <span>This Question Paper is <strong>Approved &amp; Locked</strong>. Switch to Tab 2 to unlock if you want to regenerate or edit.</span>
              </div>
            }

            <div class="form-grid-2">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Chapter / Topic Name *</mat-label>
                <input matInput formControlName="chapterTitle" placeholder="e.g., Chapter 4: Quadratic Equations" />
              </mat-form-field>
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Subject *</mat-label>
                <input matInput formControlName="subject" placeholder="e.g., Mathematics" />
              </mat-form-field>
            </div>

            <div class="form-grid-3">
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Paper Language / Medium</mat-label>
                <mat-select formControlName="language">
                  <mat-option value="English">English Medium</mat-option>
                  <mat-option value="Hindi">Hindi Medium (हिंदी)</mat-option>
                  <mat-option value="Bilingual">Bilingual (English + हिंदी)</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>Exam Duration (Minutes)</mat-label>
                <input matInput type="number" formControlName="durationMinutes" min="15" max="240" />
              </mat-form-field>

              <div class="computed-marks-box">
                <span class="cm-label">Blueprint Total</span>
                <span class="cm-value">{{ blueprintTotalQuestions }} Qs &bull; {{ blueprintTotalMarks }} Marks</span>
              </div>
            </div>

            <!-- Blueprint Section Matrix -->
            <div class="section-card">
              <div class="section-card-title">
                <mat-icon>tune</mat-icon>
                <span>Paper Blueprint &amp; Difficulty Mix</span>
              </div>
              <div class="blueprint-grid">
                <div class="bp-item">
                  <span class="bp-head">Section A: MCQ</span>
                  <div class="bp-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Count</mat-label>
                      <input matInput type="number" formControlName="mcqCount" min="0" max="50" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Marks Each</mat-label>
                      <input matInput type="number" formControlName="mcqMarks" min="0.5" step="0.5" />
                    </mat-form-field>
                  </div>
                </div>

                <div class="bp-item">
                  <span class="bp-head">Section B: Fill in Blanks</span>
                  <div class="bp-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Count</mat-label>
                      <input matInput type="number" formControlName="fillBlankCount" min="0" max="30" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Marks Each</mat-label>
                      <input matInput type="number" formControlName="fillBlankMarks" min="0.5" step="0.5" />
                    </mat-form-field>
                  </div>
                </div>

                <div class="bp-item">
                  <span class="bp-head">Section C: Short Answer</span>
                  <div class="bp-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Count</mat-label>
                      <input matInput type="number" formControlName="shortCount" min="0" max="30" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Marks Each</mat-label>
                      <input matInput type="number" formControlName="shortMarks" min="1" step="0.5" />
                    </mat-form-field>
                  </div>
                </div>

                <div class="bp-item">
                  <span class="bp-head">Section D: Long Answer</span>
                  <div class="bp-inputs">
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Count</mat-label>
                      <input matInput type="number" formControlName="longCount" min="0" max="15" />
                    </mat-form-field>
                    <mat-form-field appearance="outline" subscriptSizing="dynamic">
                      <mat-label>Marks Each</mat-label>
                      <input matInput type="number" formControlName="longMarks" min="1" step="1" />
                    </mat-form-field>
                  </div>
                </div>
              </div>

              <div class="diff-row">
                <span class="diff-lbl">Difficulty Mix (%):</span>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="diff-field">
                  <mat-label>Easy %</mat-label>
                  <input matInput type="number" formControlName="easyPercent" min="0" max="100" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="diff-field">
                  <mat-label>Medium %</mat-label>
                  <input matInput type="number" formControlName="mediumPercent" min="0" max="100" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="diff-field">
                  <mat-label>Hard %</mat-label>
                  <input matInput type="number" formControlName="hardPercent" min="0" max="100" />
                </mat-form-field>
              </div>
            </div>

            <!-- Chapter Source Input: Upload PDF/Image OR Copy-Paste Text -->
            <div class="section-card">
              <div class="section-card-title">
                <mat-icon>menu_book</mat-icon>
                <span>Chapter Source Content (Upload PDF / Book Page Photos OR Copy-Paste Notes)</span>
              </div>

              <div class="upload-zone">
                <input
                  #fileInput
                  type="file"
                  multiple
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  (change)="onFilesSelected($event)"
                  style="display: none" />
                <button type="button" mat-stroked-button color="primary" (click)="fileInput.click()" [disabled]="isPaperLocked || loading">
                  <mat-icon>cloud_upload</mat-icon> Upload Chapter PDF / Book Page Photos (Max 6 files)
                </button>
                <span class="upload-hint">Gemini AI reads Hindi &amp; English PDFs and book photos directly!</span>
              </div>

              @if (uploadedFiles.length > 0) {
                <div class="file-chip-list">
                  @for (f of uploadedFiles; track f.fileName; let idx = $index) {
                    <span class="file-chip">
                      <mat-icon>{{ f.mimeType.includes('pdf') ? 'picture_as_pdf' : 'image' }}</mat-icon>
                      <span>{{ f.fileName }} ({{ f.sizeKb }} KB)</span>
                      <button type="button" class="remove-file-btn" (click)="removeFile(idx)">
                        <mat-icon>close</mat-icon>
                      </button>
                    </span>
                  }
                </div>
              }

              <mat-form-field appearance="outline" class="full-width chapter-textarea">
                <mat-label>Copy-Paste Chapter Text / Syllabus / Key Notes</mat-label>
                <textarea
                  matInput
                  formControlName="chapterText"
                  rows="7"
                  placeholder="Paste chapter paragraphs, formulas, definitions, or key syllabus points here... AI will strictly generate exam questions grounded in this content."></textarea>
              </mat-form-field>
            </div>

            <div class="generate-action-row">
              @if (!aiConfig.isConfigured) {
                <span class="no-key-warning">
                  <mat-icon>info</mat-icon> Gemini API Key not configured yet. Click <strong>Setup Gemini Key</strong> above to connect.
                </span>
              }
              <button
                type="button"
                mat-flat-button
                color="primary"
                class="generate-ai-btn"
                [disabled]="loading || isPaperLocked || (!data.canCreate && !data.canEdit)"
                (click)="generateWithAi()">
                <mat-icon>auto_awesome</mat-icon>
                <span>{{ loading ? 'Generating with Agentic AI...' : (questions.length > 0 ? 'Regenerate Full Paper with Agentic AI' : 'Generate Question Paper with Agentic AI') }}</span>
              </button>
            </div>
          </form>
        }

        <!-- TAB 2: REVIEW, EDIT & MAKER-CHECKER APPROVAL -->
        @if (activeTab === 'editor') {
          <div class="editor-layout">
            <!-- Approval & Verification Ribbon -->
            <div class="approval-ribbon">
              <div class="ribbon-left">
                <span class="meta-badge"><mat-icon>quiz</mat-icon> {{ questions.length }} Questions</span>
                <span class="meta-badge"><mat-icon>workspace_premium</mat-icon> Total: {{ computedPaperMarks }} Marks</span>
                @if (aiModelUsed) {
                  <span class="meta-badge ai-badge"><mat-icon>psychology</mat-icon> {{ aiModelUsed }}</span>
                }
                @if (verificationSummary) {
                  <span class="meta-badge verify-badge" [matTooltip]="verificationSummary">
                    <mat-icon>verified</mat-icon> AI Critic Verified
                  </span>
                }
              </div>

              <div class="ribbon-actions">
                @if (!isPaperLocked && (data.canCreate || data.canEdit)) {
                  <button type="button" mat-stroked-button (click)="addBlankQuestion()" [disabled]="loading">
                    <mat-icon>add</mat-icon> Add Question
                  </button>
                  <button type="button" mat-flat-button color="primary" (click)="saveManualEdits()" [disabled]="loading">
                    <mat-icon>save</mat-icon> Save Edits
                  </button>
                }
                @if ((paperStatus === 'Draft' || paperStatus === 'RevisionRequested') && (data.canCreate || data.canEdit)) {
                  <button type="button" mat-stroked-button class="submit-approval-btn" (click)="submitForApproval()" [disabled]="loading">
                    <mat-icon>send</mat-icon> Submit for Approval
                  </button>
                }
                @if (paperStatus !== 'ApprovedAndLocked' && data.canEdit) {
                  <button type="button" mat-flat-button class="approve-lock-btn" (click)="approveAndLock()" [disabled]="loading">
                    <mat-icon>verified</mat-icon> Approve &amp; Lock
                  </button>
                }
                @if (paperStatus === 'SubmittedForApproval' && data.canEdit) {
                  <button type="button" mat-stroked-button color="warn" (click)="requestRevision()" [disabled]="loading">
                    <mat-icon>undo</mat-icon> Request Revision
                  </button>
                }
                @if (paperStatus === 'ApprovedAndLocked' && data.canEdit) {
                  <button type="button" mat-stroked-button (click)="unlockPaper()" [disabled]="loading">
                    <mat-icon>lock_open</mat-icon> Unlock Paper
                  </button>
                }
              </div>
            </div>

            @if (revisionRemarks && paperStatus === 'RevisionRequested') {
              <div class="revision-alert">
                <mat-icon>feedback</mat-icon>
                <div>
                  <strong>Revision Requested:</strong> {{ revisionRemarks }}
                </div>
              </div>
            }

            <!-- General Instructions -->
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
              <mat-label>General Instructions (Printed at top of Question Paper)</mat-label>
              <input matInput [formControl]="instructionsControl" [readonly]="isPaperLocked" />
            </mat-form-field>

            <!-- Questions List -->
            <div class="questions-list">
              @for (q of questions; track q.qNo; let idx = $index) {
                <div class="q-card" [class.editing]="editingIndex === idx">
                  <div class="q-card-top">
                    <div class="q-tags">
                      <span class="q-num">Q{{ q.qNo }}</span>
                      <span class="q-chip section-chip">{{ q.section }}</span>
                      <span class="q-chip type-chip">{{ q.type }}</span>
                      <span class="q-chip diff-chip" [ngClass]="'diff-' + (q.difficulty || 'medium').toLowerCase()">{{ q.difficulty }}</span>
                      @if (q.topic) {
                        <span class="q-chip topic-chip">{{ q.topic }}</span>
                      }
                      <span class="q-marks">{{ q.marks }} M</span>
                    </div>

                    @if (!isPaperLocked && (data.canCreate || data.canEdit)) {
                      <div class="q-actions">
                        <button type="button" mat-icon-button (click)="toggleEditQuestion(idx)" matTooltip="Edit Question">
                          <mat-icon>{{ editingIndex === idx ? 'check' : 'edit' }}</mat-icon>
                        </button>
                        <button type="button" mat-icon-button color="primary" (click)="regenerateSingleQuestion(q)" [disabled]="loading" matTooltip="Regenerate this question with AI">
                          <mat-icon>autorenew</mat-icon>
                        </button>
                        <button type="button" mat-icon-button color="warn" (click)="deleteQuestion(idx)" [disabled]="loading" matTooltip="Remove Question">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    }
                  </div>

                  @if (editingIndex === idx) {
                    <form [formGroup]="questionEditForm" class="q-edit-form">
                      <div class="edit-row-meta">
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Section</mat-label>
                          <input matInput formControlName="section" />
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Type</mat-label>
                          <mat-select formControlName="type">
                            <mat-option value="MCQ">MCQ</mat-option>
                            <mat-option value="FillInBlank">FillInBlank</mat-option>
                            <mat-option value="ShortAnswer">ShortAnswer</mat-option>
                            <mat-option value="LongAnswer">LongAnswer</mat-option>
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Difficulty</mat-label>
                          <mat-select formControlName="difficulty">
                            <mat-option value="Easy">Easy</mat-option>
                            <mat-option value="Medium">Medium</mat-option>
                            <mat-option value="Hard">Hard</mat-option>
                          </mat-select>
                        </mat-form-field>
                        <mat-form-field appearance="outline" subscriptSizing="dynamic">
                          <mat-label>Marks</mat-label>
                          <input matInput type="number" formControlName="marks" min="0.5" step="0.5" />
                        </mat-form-field>
                      </div>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                        <mat-label>Question Text</mat-label>
                        <textarea matInput formControlName="questionText" rows="2"></textarea>
                      </mat-form-field>
                      @if (questionEditForm.get('type')?.value === 'MCQ') {
                        <div class="options-edit-grid">
                          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Option A</mat-label><input matInput formControlName="optA" /></mat-form-field>
                          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Option B</mat-label><input matInput formControlName="optB" /></mat-form-field>
                          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Option C</mat-label><input matInput formControlName="optC" /></mat-form-field>
                          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>Option D</mat-label><input matInput formControlName="optD" /></mat-form-field>
                        </div>
                      }
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                        <mat-label>Correct Answer / Model Answer</mat-label>
                        <textarea matInput formControlName="correctAnswer" rows="2"></textarea>
                      </mat-form-field>
                      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="full-width">
                        <mat-label>Marking Scheme / Rubric</mat-label>
                        <input matInput formControlName="markingScheme" />
                      </mat-form-field>
                      <div class="edit-actions-row">
                        <button type="button" mat-stroked-button (click)="cancelEditQuestion()">Cancel</button>
                        <button type="button" mat-flat-button color="primary" (click)="applyEditQuestion(idx)">Apply to Paper</button>
                      </div>
                    </form>
                  } @else {
                    <div class="q-text">{{ q.questionText }}</div>
                    @if (q.options && q.options.length > 0) {
                      <div class="q-options-grid">
                        @for (opt of q.options; track $index; let oi = $index) {
                          <div class="q-opt"><strong>({{ ['A','B','C','D'][oi] }})</strong> {{ opt }}</div>
                        }
                      </div>
                    }
                    <div class="q-answer-box">
                      <div><strong>Answer:</strong> {{ q.correctAnswer }}</div>
                      @if (q.markingScheme) {
                        <div class="q-rubric"><strong>Marking Scheme:</strong> {{ q.markingScheme }}</div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        <!-- TAB 3: PRINTABLE A4 QUESTION PAPER (SET A/B/C) & ANSWER KEY -->
        @if (activeTab === 'print') {
          <div class="print-controls-bar">
            <div class="set-switcher">
              <span class="set-lbl">Paper Set:</span>
              <button type="button" class="set-pill" [class.active]="selectedPrintSet === 'A'" (click)="selectPrintSet('A')">Set A (Original)</button>
              <button type="button" class="set-pill" [class.active]="selectedPrintSet === 'B'" (click)="selectPrintSet('B')">Set B (Shuffled)</button>
              <button type="button" class="set-pill" [class.active]="selectedPrintSet === 'C'" (click)="selectPrintSet('C')">Set C (Shuffled)</button>
            </div>
            <div class="print-actions">
              <button type="button" mat-flat-button color="primary" (click)="printPaper(false)">
                <mat-icon>print</mat-icon> Print Question Paper (Set {{ selectedPrintSet }})
              </button>
              <button type="button" mat-stroked-button color="primary" (click)="printPaper(true)">
                <mat-icon>fact_check</mat-icon> Print Answer Key &amp; Rubric
              </button>
            </div>
          </div>

          <div class="a4-preview-sheet">
            <div class="sheet-header">
              @if (instituteLogoUrl) {
                <img [src]="instituteLogoUrl" alt="Logo" class="sheet-logo" />
              }
              <div class="sheet-org">
                <h2>{{ instituteName }}</h2>
                @if (branchAddress) {
                  <p class="sheet-addr">{{ branchAddress }}</p>
                }
                <div class="sheet-exam-title">{{ data.title }} — <strong>SET {{ selectedPrintSet }}</strong></div>
              </div>
            </div>

            <div class="sheet-meta-bar">
              <span><strong>Subject:</strong> {{ generatorForm.get('subject')?.value || data.subject }}</span>
              @if (data.batchName) { <span><strong>Batch:</strong> {{ data.batchName }}</span> }
              <span><strong>Chapter:</strong> {{ generatorForm.get('chapterTitle')?.value }}</span>
              <span><strong>Time:</strong> {{ generatorForm.get('durationMinutes')?.value || 60 }} Mins</span>
              <span><strong>Max Marks:</strong> {{ computedPaperMarks }}</span>
            </div>

            <div class="sheet-student-strip">
              <span>Student Name: ______________________________</span>
              <span>Coaching Roll No: _________________</span>
              <span>Date: ____________</span>
            </div>

            @if (instructionsControl.value) {
              <div class="sheet-instructions">
                <strong>General Instructions:</strong> {{ instructionsControl.value }}
              </div>
            }

            <div class="sheet-questions">
              @for (q of printQuestions; track q.qNo) {
                <div class="sheet-q-item">
                  <div class="sheet-q-line">
                    <span class="sheet-q-no">Q{{ q.qNo }}.</span>
                    <span class="sheet-q-text">{{ q.questionText }}</span>
                    <span class="sheet-q-marks">[{{ q.marks }}]</span>
                  </div>
                  @if (q.options && q.options.length > 0) {
                    <div class="sheet-opts">
                      @for (opt of q.options; track $index; let oi = $index) {
                        <span>({{ ['A','B','C','D'][oi] }}) {{ opt }}</span>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </mat-dialog-content>

      <div class="dialog-footer">
        <span class="footer-note">
          <mat-icon>verified_user</mat-icon>
          100% Chapter-Grounded Agentic AI &bull; Role-Based Approval Workflow
        </span>
        <button type="button" mat-stroked-button [disabled]="loading" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .ai-paper-dialog {
      position: relative;
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 92vh;
      background: #f8fafc;
    }

    .ai-processing-overlay {
      position: absolute;
      inset: 0;
      z-index: 50;
      background: rgba(248, 250, 252, 0.84);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .ai-processing-card {
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 28px 32px;
      max-width: 460px;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 14px;
      box-shadow: 0 20px 40px -12px rgba(30, 58, 138, 0.22);
    }
    .ai-proc-title {
      font-size: 0.96rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.45;
    }
    .ai-proc-sub {
      font-size: 0.8rem;
      color: #64748b;
      line-height: 1.4;
    }

    /* Strict ERP Light-Blue Gradient Dialog Header */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header-icon-box {
      width: 42px;
      height: 42px;
      border-radius: 10px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .dialog-title {
      margin: 0;
      font-size: 1.12rem;
      font-weight: 700;
      color: #1e3a8a;
    }
    .dialog-subtitle {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: #3b82f6;
      strong { color: #1e40af; }
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; }
    }
    .ai-key-btn {
      height: 34px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      border-color: #93c5fd !important;
      color: #1d4ed8 !important;
      background: #ffffff;
      &.configured {
        border-color: #86efac !important;
        color: #15803d !important;
        background: #f0fdf4;
      }
    }

    .status-pill {
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .status-draft { background: #e2e8f0; color: #334155; }
    .status-submittedforapproval { background: #fef3c7; color: #b45309; }
    .status-approvedandlocked { background: #dcfce7; color: #15803d; }
    .status-revisionrequested { background: #fee2e2; color: #b91c1c; }

    .agent-loader-strip {
      background: #eff6ff;
      border-bottom: 1px solid #bfdbfe;
    }
    .agent-loader-text {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 20px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #1e40af;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }

    .ai-key-panel {
      background: #ffffff;
      border-bottom: 1px solid #cbd5e1;
      padding: 12px 20px;
    }
    .ai-key-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ai-key-info {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.8rem;
      color: #334155;
      mat-icon { color: #2563eb; }
      p { margin: 2px 0 0; color: #64748b; }
      a { color: #2563eb; font-weight: 600; }
      code { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; color: #0f172a; }
    }
    .ai-key-inputs {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      .key-field { flex: 1 1 260px; }
      .model-field { flex: 0 1 230px; }
    }

    .studio-tabs {
      display: flex;
      gap: 6px;
      padding: 10px 20px 0;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
    }
    .studio-tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 16px;
      border: none;
      border-bottom: 2.5px solid transparent;
      background: transparent;
      color: #64748b;
      font-size: 0.84rem;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover:not(:disabled) { color: #1d4ed8; }
      &.active {
        color: #1d4ed8;
        border-bottom-color: #2563eb;
      }
      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
    }

    .dialog-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px 20px !important;
      margin: 0 !important;
      max-height: none !important;
    }

    .source-layout, .editor-layout {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .form-grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
    }
    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      align-items: center;
    }
    .computed-marks-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      .cm-label { font-size: 0.72rem; text-transform: uppercase; font-weight: 700; color: #3b82f6; }
      .cm-value { font-size: 0.96rem; font-weight: 700; color: #1e3a8a; }
    }

    .section-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .section-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 700;
      color: #1e3a8a;
      mat-icon { font-size: 19px; width: 19px; height: 19px; color: #2563eb; }
    }
    .blueprint-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
    .bp-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bp-head { font-size: 0.78rem; font-weight: 700; color: #334155; }
    .bp-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .diff-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      padding-top: 6px;
      border-top: 1px dashed #e2e8f0;
      .diff-lbl { font-size: 0.8rem; font-weight: 700; color: #475569; }
      .diff-field { width: 110px; }
    }

    .upload-zone {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      .upload-hint { font-size: 0.78rem; color: #64748b; }
    }
    .file-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .file-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 4px 10px;
      border-radius: 16px;
      font-size: 0.76rem;
      font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .remove-file-btn {
        border: none;
        background: transparent;
        cursor: pointer;
        padding: 0;
        display: inline-flex;
        color: #64748b;
        &:hover { color: #dc2626; }
      }
    }
    .full-width { width: 100%; }

    .generate-action-row {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 12px;
    }
    .no-key-warning {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: #b45309;
      background: #fffbeb;
      border: 1px solid #fde68a;
      padding: 6px 12px;
      border-radius: 8px;
      mat-icon { font-size: 17px; width: 17px; height: 17px; }
    }
    .generate-ai-btn {
      height: 44px;
      padding: 0 22px;
      border-radius: 10px;
      font-weight: 700;
    }

    .locked-banner, .revision-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 0.82rem;
    }
    .locked-banner { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .revision-alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

    .approval-ribbon {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 10px 14px;
    }
    .ribbon-left, .ribbon-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f1f5f9;
      color: #334155;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.78rem;
      font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
      &.ai-badge { background: #eef2ff; color: #4338ca; }
      &.verify-badge { background: #f0fdf4; color: #15803d; mat-icon { color: #16a34a; } }
    }
    .submit-approval-btn { border-color: #f59e0b !important; color: #b45309 !important; }
    .approve-lock-btn { background: #16a34a !important; color: #ffffff !important; }

    .questions-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .q-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      &.editing { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08); }
    }
    .q-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .q-tags {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .q-num {
      background: #1e3a8a;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .q-chip {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
    }
    .diff-easy { background: #dcfce7; color: #15803d; }
    .diff-medium { background: #fef3c7; color: #b45309; }
    .diff-hard { background: #fee2e2; color: #b91c1c; }
    .q-marks {
      font-size: 0.76rem;
      font-weight: 700;
      color: #1d4ed8;
      background: #eff6ff;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .q-text {
      font-size: 0.92rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .q-options-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 6px 14px;
      margin-bottom: 8px;
      padding-left: 8px;
      font-size: 0.84rem;
      color: #334155;
    }
    .q-answer-box {
      background: #f8fafc;
      border-left: 3px solid #16a34a;
      padding: 7px 10px;
      border-radius: 0 6px 6px 0;
      font-size: 0.8rem;
      color: #1e293b;
      .q-rubric { margin-top: 3px; color: #475569; }
    }
    .q-edit-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
    }
    .edit-row-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }
    .options-edit-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;
    }
    .edit-actions-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Tab 3: A4 Print Preview */
    .print-controls-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 14px;
    }
    .set-switcher, .print-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .set-lbl { font-size: 0.82rem; font-weight: 700; color: #334155; }
    .set-pill {
      padding: 6px 14px;
      border-radius: 18px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      &.active {
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
      }
    }

    .a4-preview-sheet {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 24px 28px;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
      color: #0f172a;
    }
    .sheet-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 12px;
      text-align: center;
      .sheet-logo { height: 52px; width: auto; object-fit: contain; }
      h2 { margin: 0; font-size: 1.3rem; font-weight: 800; text-transform: uppercase; }
      .sheet-addr { margin: 2px 0; font-size: 0.8rem; color: #475569; }
      .sheet-exam-title { margin-top: 4px; font-size: 0.98rem; color: #1e3a8a; }
    }
    .sheet-meta-bar {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px 16px;
      font-size: 0.82rem;
      padding: 8px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      margin-bottom: 10px;
    }
    .sheet-student-strip {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 0.82rem;
      padding-bottom: 10px;
      margin-bottom: 10px;
      border-bottom: 1px dashed #94a3b8;
    }
    .sheet-instructions {
      font-size: 0.8rem;
      color: #334155;
      margin-bottom: 14px;
      font-style: italic;
    }
    .sheet-questions {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sheet-q-line {
      display: flex;
      gap: 8px;
      font-size: 0.9rem;
      line-height: 1.5;
      .sheet-q-no { font-weight: 700; min-width: 28px; }
      .sheet-q-text { flex: 1; }
      .sheet-q-marks { font-weight: 700; white-space: nowrap; }
    }
    .sheet-opts {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px 16px;
      padding-left: 36px;
      margin-top: 4px;
      font-size: 0.85rem;
    }

    .dialog-footer {
      padding: 10px 20px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .footer-note {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #64748b;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }
  `]
})
export class CoachingAiPaperDialogComponent implements OnInit {
  activeTab: 'source' | 'editor' | 'print' = 'source';
  private _loading = false;
  get loading(): boolean { return this._loading; }
  set loading(val: boolean) {
    this._loading = val;
    if (this.dialogRef) {
      this.dialogRef.disableClose = val;
    }
  }
  loadingMessage = '';
  showAiKeyPanel = false;
  changed = false;

  aiConfig = {
    isConfigured: false,
    provider: 'Gemini',
    modelName: 'gemini-2.5-flash',
    maskedKey: '',
    source: 'None',
    canConfigure: false
  };

  paperId: string | null = null;
  paperStatus = 'Draft';
  revisionRemarks: string | null = null;
  aiModelUsed: string | null = null;
  verificationSummary: string | null = null;
  questions: AiExamQuestion[] = [];
  printQuestions: AiExamQuestion[] = [];
  selectedPrintSet: 'A' | 'B' | 'C' = 'A';

  uploadedFiles: UploadedChapterFile[] = [];
  editingIndex: number | null = null;

  aiConfigForm: FormGroup;
  generatorForm: FormGroup;
  questionEditForm: FormGroup;
  instructionsControl = new FormControl('All questions are compulsory. Marks are indicated against each question.');

  constructor(
    public dialogRef: MatDialogRef<CoachingAiPaperDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CoachingAiPaperDialogData,
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.aiConfigForm = this.fb.group({
      apiKey: [''],
      modelName: ['gemini-2.5-flash']
    });

    this.generatorForm = this.fb.group({
      chapterTitle: [data.title || '', Validators.required],
      subject: [data.subject || '', Validators.required],
      language: ['English'],
      durationMinutes: [60],
      mcqCount: [5],
      mcqMarks: [1],
      fillBlankCount: [0],
      fillBlankMarks: [1],
      shortCount: [5],
      shortMarks: [2],
      longCount: [1],
      longMarks: [5],
      easyPercent: [30],
      mediumPercent: [50],
      hardPercent: [20],
      chapterText: ['']
    });

    this.questionEditForm = this.fb.group({
      section: ['Section A'],
      type: ['MCQ'],
      difficulty: ['Medium'],
      marks: [1],
      questionText: [''],
      optA: [''],
      optB: [''],
      optC: [''],
      optD: [''],
      correctAnswer: [''],
      markingScheme: ['']
    });
  }

  ngOnInit(): void {
    this.loadAiConfig();
    this.loadExistingPaper();
  }

  get instituteName(): string {
    return this.authService.getInstituteName() || 'Institute Examination Board';
  }

  get instituteLogoUrl(): string {
    return this.authService.getInstituteLogoUrl() || '';
  }

  get branchAddress(): string {
    const user: any = this.authService.currentUser();
    const selBranchId = this.authService.selectedBranchId();
    const branches: any[] = user?.branches || [];
    const activeBranch = branches.find(b => b.id === selBranchId) || branches.find(b => b.id === user?.branchId);
    return activeBranch?.address || user?.instituteAddress || '';
  }

  get isPaperLocked(): boolean {
    return this.paperStatus === 'ApprovedAndLocked';
  }

  get blueprintTotalQuestions(): number {
    const v = this.generatorForm.value;
    return (Number(v.mcqCount) || 0) + (Number(v.fillBlankCount) || 0) + (Number(v.shortCount) || 0) + (Number(v.longCount) || 0);
  }

  get blueprintTotalMarks(): number {
    const v = this.generatorForm.value;
    return ((Number(v.mcqCount) || 0) * (Number(v.mcqMarks) || 0))
      + ((Number(v.fillBlankCount) || 0) * (Number(v.fillBlankMarks) || 0))
      + ((Number(v.shortCount) || 0) * (Number(v.shortMarks) || 0))
      + ((Number(v.longCount) || 0) * (Number(v.longMarks) || 0));
  }

  get computedPaperMarks(): number {
    return this.questions.reduce((acc, q) => acc + (Number(q.marks) || 0), 0);
  }

  formatPaperStatus(status?: string): string {
    switch (status) {
      case 'SubmittedForApproval': return 'Pending Approval';
      case 'ApprovedAndLocked': return 'Approved & Locked';
      case 'RevisionRequested': return 'Revision Needed';
      default: return 'Draft';
    }
  }

  loadAiConfig(): void {
    this.http.get<any>(`${environment.apiUrl}/coaching-ai-exam/ai-config`).subscribe({
      next: res => {
        this.aiConfig = { ...this.aiConfig, ...res };
        this.aiConfigForm.patchValue({ modelName: res?.modelName || 'gemini-2.5-flash' });
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  saveAiConfig(): void {
    const val = this.aiConfigForm.value;
    if (!val.apiKey && !this.aiConfig.isConfigured) {
      this.confirmDialog.alert('API Key Required', 'Please paste your free Gemini API key from aistudio.google.com/apikey.', 'warning');
      return;
    }
    this.loading = true;
    this.loadingMessage = 'Saving Gemini AI configuration securely...';
    this.cdr.markForCheck();

    this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/ai-config`, val).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.aiConfig.isConfigured = !!res.isConfigured;
        this.aiConfig.maskedKey = res.maskedKey || '';
        this.aiConfig.modelName = res.modelName || 'gemini-2.5-flash';
        this.aiConfig.source = 'Tenant';
        this.aiConfigForm.patchValue({ apiKey: '' });
        this.showAiKeyPanel = false;
        this.confirmDialog.alert('Gemini Connected', 'Gemini API key saved securely. You can now generate Agentic AI question papers!', 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Could not save Gemini API key.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  loadExistingPaper(): void {
    this.loading = true;
    this.loadingMessage = 'Loading existing question paper...';
    this.http.get<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/paper`).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        if (res?.exists) {
          this.hydratePaper(res);
          this.activeTab = 'editor';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadingMessage = '';
        this.cdr.markForCheck();
      }
    });
  }

  private hydratePaper(res: any): void {
    this.paperId = res.id;
    this.paperStatus = res.paperStatus || 'Draft';
    this.revisionRemarks = res.revisionRemarks || null;
    this.aiModelUsed = res.aiModelUsed || null;
    this.verificationSummary = res.verificationSummary || null;
    this.questions = (res.questions || []).map((q: any, i: number) => ({
      ...q,
      qNo: q.qNo || i + 1,
      options: q.options || []
    }));
    this.instructionsControl.setValue(res.generalInstructions || 'All questions are compulsory. Marks are indicated against each question.');
    this.generatorForm.patchValue({
      chapterTitle: res.chapterTitle || this.data.title,
      subject: res.subject || this.data.subject,
      language: res.language || 'English',
      durationMinutes: res.durationMinutes || 60,
      chapterText: res.chapterSourceText && !res.chapterSourceText.startsWith('[Uploaded ') ? res.chapterSourceText : ''
    });
    this.selectPrintSet(this.selectedPrintSet);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files).slice(0, 6 - this.uploadedFiles.length);
    for (const file of files) {
      if (file.size > 6 * 1024 * 1024) {
        this.confirmDialog.alert('File Too Large', `"${file.name}" exceeds 6 MB limit.`, 'warning');
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.uploadedFiles.push({
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeKb: Math.max(1, Math.round(file.size / 1024)),
          base64Data: String(reader.result || '')
        });
        this.cdr.markForCheck();
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  removeFile(index: number): void {
    this.uploadedFiles.splice(index, 1);
    this.cdr.markForCheck();
  }

  generateWithAi(): void {
    const val = this.generatorForm.value;
    if (!val.chapterText?.trim() && this.uploadedFiles.length === 0) {
      this.confirmDialog.alert('Chapter Source Required', 'Please paste chapter text or upload a chapter PDF / book photo first.', 'info');
      return;
    }
    if (this.blueprintTotalQuestions === 0) {
      this.confirmDialog.alert('Blueprint Empty', 'Please enter at least 1 question in the blueprint.', 'info');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Agentic AI Pipeline: Reading chapter ➔ Designing blueprint ➔ Generating & verifying questions...';
    this.cdr.markForCheck();

    const payload = {
      ...val,
      attachments: this.uploadedFiles.map(f => ({
        fileName: f.fileName,
        mimeType: f.mimeType,
        base64Data: f.base64Data
      }))
    };

    this.http.post<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/generate`, payload).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.hydratePaper(res);
        this.activeTab = 'editor';
        this.confirmDialog.alert('Question Paper Generated', `Agentic AI generated ${this.questions.length} verified questions (${this.computedPaperMarks} Marks).`, 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        if (err?.error?.requiresApiKey) {
          this.showAiKeyPanel = true;
        }
        this.confirmDialog.alert('AI Generation Notice', err?.error?.message || 'Failed to generate question paper.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  toggleEditQuestion(idx: number): void {
    if (this.editingIndex === idx) {
      this.applyEditQuestion(idx);
      return;
    }
    const q = this.questions[idx];
    this.editingIndex = idx;
    this.questionEditForm.patchValue({
      section: q.section || 'Section A',
      type: q.type || 'MCQ',
      difficulty: q.difficulty || 'Medium',
      marks: q.marks || 1,
      questionText: q.questionText || '',
      optA: q.options?.[0] || '',
      optB: q.options?.[1] || '',
      optC: q.options?.[2] || '',
      optD: q.options?.[3] || '',
      correctAnswer: q.correctAnswer || '',
      markingScheme: q.markingScheme || ''
    });
    this.cdr.markForCheck();
  }

  cancelEditQuestion(): void {
    this.editingIndex = null;
    this.cdr.markForCheck();
  }

  applyEditQuestion(idx: number): void {
    const v = this.questionEditForm.value;
    const target = this.questions[idx];
    target.section = v.section;
    target.type = v.type;
    target.difficulty = v.difficulty;
    target.marks = Number(v.marks) || 1;
    target.questionText = v.questionText;
    target.options = v.type === 'MCQ' ? [v.optA, v.optB, v.optC, v.optD].filter(Boolean) : [];
    target.correctAnswer = v.correctAnswer;
    target.markingScheme = v.markingScheme;
    this.editingIndex = null;
    this.selectPrintSet(this.selectedPrintSet);
    this.cdr.markForCheck();
  }

  addBlankQuestion(): void {
    const nextNo = this.questions.length + 1;
    this.questions.push({
      qNo: nextNo,
      section: 'Section C',
      type: 'ShortAnswer',
      difficulty: 'Medium',
      topic: this.generatorForm.get('chapterTitle')?.value || 'Chapter Topic',
      marks: 2,
      questionText: 'Enter new question text here...',
      options: [],
      correctAnswer: '',
      markingScheme: ''
    });
    this.toggleEditQuestion(this.questions.length - 1);
  }

  deleteQuestion(idx: number): void {
    this.questions.splice(idx, 1);
    this.questions.forEach((q, i) => q.qNo = i + 1);
    if (this.editingIndex === idx) this.editingIndex = null;
    this.selectPrintSet(this.selectedPrintSet);
    this.cdr.markForCheck();
  }

  regenerateSingleQuestion(q: AiExamQuestion): void {
    if (!this.paperId) return;
    this.loading = true;
    this.loadingMessage = `Regenerating Question #${q.qNo} with Gemini AI...`;
    this.cdr.markForCheck();

    this.http.post<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}/regenerate-question`, {
      qNo: q.qNo,
      difficulty: q.difficulty
    }).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.hydratePaper(res);
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Regeneration Failed', err?.error?.message || 'Could not regenerate question.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  saveManualEdits(): void {
    if (!this.paperId) return;
    if (this.editingIndex !== null) {
      this.applyEditQuestion(this.editingIndex);
    }
    this.loading = true;
    this.loadingMessage = 'Saving question paper changes...';
    this.cdr.markForCheck();

    const payload = {
      chapterTitle: this.generatorForm.get('chapterTitle')?.value,
      language: this.generatorForm.get('language')?.value,
      durationMinutes: Number(this.generatorForm.get('durationMinutes')?.value) || 60,
      generalInstructions: this.instructionsControl.value || '',
      questions: this.questions
    };

    this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}`, payload).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.hydratePaper(res);
        this.confirmDialog.alert('Saved', 'Question paper updates saved successfully.', 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Could not save edits.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  submitForApproval(): void {
    if (!this.paperId) return;
    this.loading = true;
    this.loadingMessage = 'Submitting paper for approval...';
    this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}/submit-approval`, {}).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.hydratePaper(res);
        this.confirmDialog.alert('Submitted', 'Question paper submitted for Admin/Coordinator approval.', 'success');
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to submit paper.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  approveAndLock(): void {
    if (!this.paperId) return;
    this.confirmDialog.confirm(
      'Approve & Lock Question Paper?',
      'Once approved & locked, the question paper is ready for official Set A/B/C printing and cannot be edited unless unlocked.',
      'Approve & Lock',
      'Cancel',
      'info'
    ).subscribe(ok => {
      if (!ok) return;
      this.loading = true;
      this.loadingMessage = 'Approving & locking question paper...';
      this.cdr.markForCheck();
      this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}/approve-lock`, {}).subscribe({
        next: res => {
          this.loading = false;
          this.loadingMessage = '';
          this.changed = true;
          this.hydratePaper(res);
          this.confirmDialog.alert('Approved & Locked', 'Question paper is now Approved & Locked for exam print.', 'success');
          this.cdr.markForCheck();
        },
        error: err => {
          this.loading = false;
          this.loadingMessage = '';
          this.confirmDialog.alert('Error', err?.error?.message || 'Approval failed.', 'warning');
          this.cdr.markForCheck();
        }
      });
    });
  }

  requestRevision(): void {
    if (!this.paperId) return;
    this.confirmDialog.confirm(
      'Request Paper Revision?',
      'This will return the question paper to Revision Requested status so the creator can update it.',
      'Request Revision',
      'Cancel',
      'warning'
    ).subscribe(ok => {
      if (!ok) return;
      this.loading = true;
      this.loadingMessage = 'Sending revision request...';
      this.cdr.markForCheck();
      this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}/request-revision`, {
        remarks: 'Please review question difficulty and syllabus alignment.'
      }).subscribe({
        next: res => {
          this.loading = false;
          this.loadingMessage = '';
          this.changed = true;
          this.hydratePaper(res);
          this.cdr.markForCheck();
        },
        error: err => {
          this.loading = false;
          this.loadingMessage = '';
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to request revision.', 'warning');
          this.cdr.markForCheck();
        }
      });
    });
  }

  unlockPaper(): void {
    if (!this.paperId) return;
    this.loading = true;
    this.loadingMessage = 'Unlocking question paper...';
    this.http.put<any>(`${environment.apiUrl}/coaching-ai-exam/papers/${this.paperId}/unlock`, {}).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.changed = true;
        this.hydratePaper(res);
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Error', err?.error?.message || 'Unlock failed.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  // Deterministic Set B / Set C shuffling within each section so students can't copy!
  selectPrintSet(setCode: 'A' | 'B' | 'C'): void {
    this.selectedPrintSet = setCode;
    if (setCode === 'A') {
      this.printQuestions = this.questions.map((q, i) => ({ ...q, qNo: i + 1 }));
      return;
    }

    const seed = setCode === 'B' ? 17 : 31;
    const grouped = new Map<string, AiExamQuestion[]>();
    for (const q of this.questions) {
      const key = q.section || 'Section A';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push({ ...q });
    }

    const reordered: AiExamQuestion[] = [];
    let num = 1;
    for (const [, list] of grouped.entries()) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = (i * seed + 7) % (i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      for (const item of copy) {
        reordered.push({ ...item, qNo: num++ });
      }
    }
    this.printQuestions = reordered;
    this.cdr.markForCheck();
  }

  printPaper(answerKeyMode: boolean): void {
    const win = window.open('', '_blank', 'width=900,height=1050');
    if (!win) {
      this.confirmDialog.alert('Popup Blocked', 'Please allow popups for this site to print the question paper.', 'warning');
      return;
    }

    const list = this.printQuestions;
    const subject = this.generatorForm.get('subject')?.value || this.data.subject;
    const chapter = this.generatorForm.get('chapterTitle')?.value || this.data.title;
    const duration = this.generatorForm.get('durationMinutes')?.value || 60;
    const logoHtml = this.instituteLogoUrl ? `<img src="${this.instituteLogoUrl}" style="height:54px;object-fit:contain;" />` : '';
    const addrHtml = this.branchAddress ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${this.branchAddress}</div>` : '';
    const docHeading = answerKeyMode
      ? `${this.data.title} — OFFICIAL ANSWER KEY &amp; MARKING SCHEME (SET ${this.selectedPrintSet})`
      : `${this.data.title} — QUESTION PAPER (SET ${this.selectedPrintSet})`;

    const rowsHtml = list.map(q => {
      const optsHtml = (q.options && q.options.length > 0)
        ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;padding-left:26px;margin-top:4px;font-size:13px;">
            ${q.options.map((o, idx) => `<div><strong>(${['A','B','C','D'][idx]})</strong> ${this.escapeHtml(o)}</div>`).join('')}
           </div>`
        : '';
      const ansHtml = answerKeyMode
        ? `<div style="margin:6px 0 0 26px;padding:6px 10px;background:#f0fdf4;border-left:3px solid #16a34a;font-size:12.5px;">
             <div><strong>Answer:</strong> ${this.escapeHtml(q.correctAnswer)}</div>
             ${q.markingScheme ? `<div style="color:#475569;margin-top:2px;"><strong>Rubric:</strong> ${this.escapeHtml(q.markingScheme)}</div>` : ''}
           </div>`
        : '';
      return `
        <div style="margin-bottom:13px;page-break-inside:avoid;">
          <div style="display:flex;gap:8px;font-size:13.5px;line-height:1.5;">
            <strong style="min-width:26px;">Q${q.qNo}.</strong>
            <div style="flex:1;">${this.escapeHtml(q.questionText)}</div>
            <strong style="white-space:nowrap;">[${q.marks}]</strong>
          </div>
          ${optsHtml}
          ${ansHtml}
        </div>`;
    }).join('');

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${this.escapeHtml(docHeading)}</title>
        <style>
          @page { size: A4; margin: 14mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; }
        </style>
      </head>
      <body>
        <div style="display:flex;align-items:center;justify-content:center;gap:14px;border-bottom:2px solid #0f172a;padding-bottom:10px;margin-bottom:10px;text-align:center;">
          ${logoHtml}
          <div>
            <div style="font-size:20px;font-weight:800;text-transform:uppercase;">${this.escapeHtml(this.instituteName)}</div>
            ${addrHtml}
            <div style="font-size:13.5px;font-weight:700;color:#1e3a8a;margin-top:4px;">${docHeading}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12.5px;padding:7px 10px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:4px;margin-bottom:10px;">
          <span><strong>Subject:</strong> ${this.escapeHtml(subject)}</span>
          ${this.data.batchName ? `<span><strong>Batch:</strong> ${this.escapeHtml(this.data.batchName)}</span>` : ''}
          <span><strong>Chapter:</strong> ${this.escapeHtml(chapter)}</span>
          <span><strong>Time:</strong> ${duration} Mins</span>
          <span><strong>Max Marks:</strong> ${this.computedPaperMarks}</span>
        </div>
        ${!answerKeyMode ? `
          <div style="display:flex;justify-content:space-between;font-size:12.5px;padding-bottom:8px;margin-bottom:10px;border-bottom:1px dashed #94a3b8;">
            <span>Name: _______________________________</span>
            <span>Roll No: ________________</span>
            <span>Date: ___________</span>
          </div>
          <div style="font-size:12px;color:#334155;font-style:italic;margin-bottom:14px;">
            <strong>General Instructions:</strong> ${this.escapeHtml(this.instructionsControl.value || '')}
          </div>
        ` : ''}
        ${rowsHtml}
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `);
    win.document.close();
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  close(): void {
    if (this.loading) return;
    this.dialogRef.close({ changed: this.changed });
  }
}
