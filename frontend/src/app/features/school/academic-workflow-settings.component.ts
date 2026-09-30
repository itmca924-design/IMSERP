import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { SchoolService, ExamSettingDto, UpdateExamSettingDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-academic-workflow-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="academic-workflow-container">
      <!-- Page Header with Standard Project Light Blue Styling -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>tune</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Academic Session & Exam Workflow Master</h1>
            <p class="page-subtitle">Centralized master control for active academic year, upcoming promotion sessions, exam term types, evaluation turnaround SLA, and board certification rules.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" class="save-master-btn" (click)="saveSettings()" [disabled]="saving || loading">
            <mat-spinner diameter="18" *ngIf="saving"></mat-spinner>
            <mat-icon *ngIf="!saving" class="btn-icon">save</mat-icon>
            <span>Save Configurations</span>
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading">
        <mat-spinner diameter="42"></mat-spinner>
        <p>Loading Academic Session & Workflow settings...</p>
      </div>

      <div class="content-body" *ngIf="!loading">
        <!-- Live Status Bar -->
        <div class="live-status-bar">
          <div class="status-item active-session-item">
            <div class="status-label">ACTIVE ACADEMIC SESSION</div>
            <div class="status-value">
              <span class="active-pulse-dot"></span>
              <strong>{{ activeAcademicYear }}</strong>
            </div>
          </div>
          <div class="status-item">
            <div class="status-label">NEXT PROMOTION TARGET</div>
            <div class="status-value text-secondary">
              <mat-icon>trending_up</mat-icon> {{ nextAcademicYear }}
            </div>
          </div>
          <div class="status-item">
            <div class="status-label">CONFIGURED SESSIONS</div>
            <div class="status-value text-secondary">
              <mat-icon>calendar_month</mat-icon> {{ sessionsList.length }} Years
            </div>
          </div>
          <div class="status-item">
            <div class="status-label">EXAM TYPES & TERMS</div>
            <div class="status-value text-secondary">
              <mat-icon>assignment</mat-icon> {{ examTypesList.length }} Workflows
            </div>
          </div>
          <div class="status-item">
            <div class="status-label">EVALUATION SLA</div>
            <div class="status-value text-secondary">
              <mat-icon>timelapse</mat-icon> {{ evaluationDueDays }} Days Due
            </div>
          </div>
        </div>

        <div class="settings-grid">
          <!-- CARD 1: Academic Sessions Master -->
          <mat-card class="setting-card">
            <div class="card-header-strip">
              <div class="card-title-group">
                <mat-icon class="card-icon session-icon">event_repeat</mat-icon>
                <div>
                  <h3 class="card-title">Academic Sessions Master (सत्र प्रबंधन)</h3>
                  <p class="card-desc">Control active year across ERP. When new year starts, switch active session here in one click without modifying any code.</p>
                </div>
              </div>
            </div>

            <div class="card-content">
              <div class="form-row-two">
                <mat-form-field appearance="outline">
                  <mat-label>Current Active Session (सभी मॉड्यूल्स में एक्टिव)</mat-label>
                  <mat-select [(ngModel)]="activeAcademicYear">
                    <mat-option *ngFor="let s of sessionsList" [value]="s">
                      ⭐ {{ s }} (Active)
                    </mat-option>
                  </mat-select>
                  <mat-hint>Used as default session in examinations, attendance & marks</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Next / Promotion Target Session</mat-label>
                  <mat-select [(ngModel)]="nextAcademicYear">
                    <mat-option *ngFor="let s of sessionsList" [value]="s">
                      🚀 {{ s }}
                    </mat-option>
                  </mat-select>
                  <mat-hint>Target session for student upgrades and class promotion</mat-hint>
                </mat-form-field>
              </div>

              <!-- Catalog of Configured Sessions -->
              <div class="catalog-section">
                <div class="catalog-title">Available Sessions Catalog</div>
                <div class="chips-container">
                  <div class="session-chip" *ngFor="let s of sessionsList" [class.is-active]="s === activeAcademicYear">
                    <span class="chip-text">{{ s }}</span>
                    <span class="active-badge" *ngIf="s === activeAcademicYear">ACTIVE</span>
                    <button type="button" class="chip-del-btn" *ngIf="s !== activeAcademicYear" (click)="removeSession(s)" matTooltip="Remove Session">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>

                <div class="add-inline-row">
                  <mat-form-field appearance="outline" class="inline-input-field" subscriptSizing="dynamic">
                    <mat-label>Add New Session (e.g. 2026-2027, 2027-2028)</mat-label>
                    <input matInput [(ngModel)]="newSessionInput" placeholder="YYYY-YYYY" (keyup.enter)="addSession()">
                  </mat-form-field>
                  <button mat-stroked-button color="primary" class="inline-add-btn" (click)="addSession()" [disabled]="!newSessionInput">
                    <mat-icon>add</mat-icon> Add Session
                  </button>
                </div>
              </div>
            </div>
          </mat-card>

          <!-- CARD 2: Exam Types & Terms Master -->
          <mat-card class="setting-card">
            <div class="card-header-strip">
              <div class="card-title-group">
                <mat-icon class="card-icon exam-icon">assignment</mat-icon>
                <div>
                  <h3 class="card-title">Exam Types & Term Workflow Master (परीक्षा प्रकार)</h3>
                  <p class="card-desc">Define standard examination workflows available across bulk schedulers, admit cards, and evaluation matrices.</p>
                </div>
              </div>
            </div>

            <div class="card-content">
              <div class="catalog-section">
                <div class="catalog-title">Active Exam Types Catalog</div>
                <div class="chips-container">
                  <div class="type-chip" *ngFor="let t of examTypesList">
                    <mat-icon class="type-icon">task_alt</mat-icon>
                    <span class="chip-text">{{ t }}</span>
                    <button type="button" class="chip-del-btn" (click)="removeExamType(t)" matTooltip="Remove Exam Type" *ngIf="examTypesList.length > 1">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>

                <div class="add-inline-row">
                  <mat-form-field appearance="outline" class="inline-input-field" subscriptSizing="dynamic">
                    <mat-label>Add Custom Exam Type (e.g. Pre-Board 2, Periodic Test 3)</mat-label>
                    <input matInput [(ngModel)]="newExamTypeInput" placeholder="Exam Type Name" (keyup.enter)="addExamType()">
                  </mat-form-field>
                  <button mat-stroked-button color="primary" class="inline-add-btn" (click)="addExamType()" [disabled]="!newExamTypeInput">
                    <mat-icon>add</mat-icon> Add Exam Type
                  </button>
                </div>
              </div>
            </div>
          </mat-card>

          <!-- CARD 3: Evaluation SLA & Benchmark Rules -->
          <mat-card class="setting-card">
            <div class="card-header-strip">
              <div class="card-title-group">
                <mat-icon class="card-icon rules-icon">speed</mat-icon>
                <div>
                  <h3 class="card-title">Evaluation Turnaround & Pass Benchmarks</h3>
                  <p class="card-desc">Automate answer sheet evaluation due dates, passing criteria, and promotion eligibility formulas.</p>
                </div>
              </div>
            </div>

            <div class="card-content">
              <div class="form-row-three">
                <mat-form-field appearance="outline">
                  <mat-label>Evaluation Due Turnaround (Days)</mat-label>
                  <input matInput type="number" [(ngModel)]="evaluationDueDays" min="1" max="60">
                  <mat-hint>Auto sets teacher checking deadline: Exam Date + N days</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Passing Benchmark (%)</mat-label>
                  <input matInput type="number" [(ngModel)]="passingPercentage" min="1" max="100">
                  <mat-hint>Default passing percentage (Standard: 33%)</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Max Compartment Subjects</mat-label>
                  <input matInput type="number" [(ngModel)]="maxCompartmentSubjects" min="0" max="6">
                  <mat-hint>Subjects allowed before student is detained</mat-hint>
                </mat-form-field>
              </div>

              <div class="grace-marks-box">
                <div class="grace-left">
                  <mat-slide-toggle color="primary" [(ngModel)]="allowGraceMarks">
                    <strong>Allow Grace Marks for Borderline Promotion</strong>
                  </mat-slide-toggle>
                  <p class="grace-desc">When enabled, students failing by small margin can receive up to max grace marks to achieve passing criteria.</p>
                </div>
                <div class="grace-right" *ngIf="allowGraceMarks">
                  <mat-form-field appearance="outline" class="grace-input" subscriptSizing="dynamic">
                    <mat-label>Max Grace Marks</mat-label>
                    <input matInput type="number" [(ngModel)]="maxGraceMarks" min="1" max="15">
                  </mat-form-field>
                </div>
              </div>
            </div>
          </mat-card>

          <!-- CARD 4: Board Affiliation & Official Signatures -->
          <mat-card class="setting-card">
            <div class="card-header-strip">
              <div class="card-title-group">
                <mat-icon class="card-icon cert-icon">verified</mat-icon>
                <div>
                  <h3 class="card-title">Board Affiliation & Official Verification</h3>
                  <p class="card-desc">Header credentials and signatory titles printed on Blank Award Sheets, BSEB Marksheets, and Report Cards.</p>
                </div>
              </div>
            </div>

            <div class="card-content">
              <div class="form-row-three">
                <mat-form-field appearance="outline">
                  <mat-label>School Affiliation / Roll Code</mat-label>
                  <input matInput [(ngModel)]="schoolAffiliationNumber" placeholder="e.g. CBSE/AFF-11025">
                  <mat-hint>Printed in header of marksheets</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Principal Signature Title</mat-label>
                  <input matInput [(ngModel)]="principalSignTitle" placeholder="Principal / Headmaster">
                  <mat-hint>Authority signature designation</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Class Teacher Signature Title</mat-label>
                  <input matInput [(ngModel)]="classTeacherSignTitle" placeholder="Class Teacher">
                  <mat-hint>Scrutinizer / Teacher designation</mat-hint>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="form-full">
                <mat-label>Result Declaration Statement / Continuous Policy Note</mat-label>
                <textarea matInput [(ngModel)]="resultDeclarationNote" rows="2" placeholder="Official statement printed at bottom of result cards..."></textarea>
                <mat-hint>Legal disclaimer and examination certification declaration</mat-hint>
              </mat-form-field>
            </div>
          </mat-card>
        </div>

        <!-- Bottom Advisory Note -->
        <div class="bottom-advisory-bar">
          <mat-icon class="advisory-icon">info</mat-icon>
          <span>Changes made here take immediate effect across all Examination, Promotion, and Result modules without requiring server restarts or code changes.</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .academic-workflow-container {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: 0 0 32px 0;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.05);

      .header-left {
        display: flex;
        align-items: center;
        gap: 16px;

        .header-icon-box {
          background: #2563eb;
          color: #ffffff;
          width: 48px;
          height: 48px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);

          mat-icon {
            font-size: 26px;
            width: 26px;
            height: 26px;
          }
        }

        .page-title {
          font-size: 20px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0 0 4px 0;
        }

        .page-subtitle {
          font-size: 13px;
          color: #3b82f6;
          margin: 0;
          max-width: 800px;
          line-height: 1.4;
        }
      }

      .save-master-btn {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 600;
        padding: 0 24px !important;
        height: 44px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
        overflow: visible !important;

        ::ng-deep .mdc-button__label,
        .mdc-button__label {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          overflow: visible !important;
          line-height: 1 !important;
        }

        .btn-icon,
        mat-icon {
          font-size: 20px !important;
          width: 20px !important;
          height: 20px !important;
          line-height: 20px !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 !important;
          overflow: visible !important;
          vertical-align: middle !important;
          flex-shrink: 0 !important;
        }
      }
    }

    /* Live Status Bar */
    .live-status-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;

      .status-item {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px 18px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

        .status-label {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: #64748b;
          margin-bottom: 6px;
        }

        .status-value {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #3b82f6;
          }

          &.text-secondary {
            color: #334155;
          }
        }

        &.active-session-item {
          background: #f0fdf4;
          border-color: #bbf7d0;

          .status-label {
            color: #166534;
          }

          .status-value {
            color: #15803d;
          }

          .active-pulse-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
            animation: pulse 1.8s infinite;
          }
        }
      }
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
      100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
    }

    /* Grid Layout */
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      margin-bottom: 24px;
    }

    .setting-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);

      .card-header-strip {
        padding: 16px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;

        .card-title-group {
          display: flex;
          align-items: center;
          gap: 12px;

          .card-icon {
            font-size: 24px;
            width: 24px;
            height: 24px;

            &.session-icon { color: #2563eb; }
            &.exam-icon { color: #8b5cf6; }
            &.rules-icon { color: #0284c7; }
            &.cert-icon { color: #10b981; }
          }

          .card-title {
            font-size: 15px;
            font-weight: 700;
            color: #0f172a;
            margin: 0 0 2px 0;
          }

          .card-desc {
            font-size: 12px;
            color: #64748b;
            margin: 0;
          }
        }
      }

      .card-content {
        padding: 20px;
      }
    }

    .form-row-two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-row-three {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-full {
      width: 100%;
    }

    /* Catalog Section */
    .catalog-section {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;

      .catalog-title {
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #475569;
        margin-bottom: 12px;
      }

      .chips-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }

      .session-chip, .type-chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 20px;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        transition: all 0.15s ease;

        &.is-active {
          background: #eff6ff;
          border-color: #2563eb;
          color: #1e40af;

          .active-badge {
            background: #2563eb;
            color: #ffffff;
            font-size: 9.5px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 10px;
          }
        }

        .type-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #8b5cf6;
        }

        .chip-del-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          color: #94a3b8;

          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
          }

          &:hover {
            color: #ef4444;
          }
        }
      }

      .add-inline-row {
        display: flex;
        gap: 12px;
        align-items: center;

        .inline-input-field {
          flex: 1;
        }

        .inline-add-btn {
          height: 48px;
          border-radius: 8px;
          font-weight: 600;
        }
      }
    }

    /* Grace Marks Box */
    .grace-marks-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;

      .grace-desc {
        font-size: 12px;
        color: #64748b;
        margin: 4px 0 0 0;
      }

      .grace-input {
        width: 150px;
      }
    }

    /* Bottom Advisory Bar */
    .bottom-advisory-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px 20px;
      font-size: 13px;
      color: #1e3a8a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);

      .advisory-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }
    }

    .loading-state {
      text-align: center;
      padding: 60px 0;
      color: #64748b;

      mat-spinner {
        margin: 0 auto 16px;
      }
    }

    @media (max-width: 900px) {
      .form-row-two, .form-row-three {
        grid-template-columns: 1fr;
      }
      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
      .sticky-footer-bar {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }
    }
  `]
})
export class AcademicWorkflowSettingsComponent implements OnInit {
  loading = false;
  saving = false;

  // Active & Available Sessions
  activeAcademicYear = '2025-2026';
  nextAcademicYear = '2026-2027';
  sessionsList: string[] = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
  newSessionInput = '';

  // Exam Types
  examTypesList: string[] = [
    'Unit Test 1',
    'Unit Test 2',
    'Quarterly Exam',
    'Half Yearly Exam',
    'Pre-Board Exam',
    'Annual Exam'
  ];
  newExamTypeInput = '';

  // Workflow SLA & Benchmarks
  evaluationDueDays = 7;
  passingPercentage = 33;
  maxCompartmentSubjects = 2;
  allowGraceMarks = true;
  maxGraceMarks = 5;

  // Certification Details
  schoolAffiliationNumber = 'CBSE/STATE-AFF-2025';
  principalSignTitle = 'Principal / Headmaster';
  classTeacherSignTitle = 'Class Teacher';
  resultDeclarationNote = 'Continuous and Comprehensive Evaluation Scheme';

  constructor(
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.schoolService.getExamSettings().subscribe({
      next: (setting) => {
        this.loading = false;
        if (setting) {
          if (setting.activeAcademicYear) this.activeAcademicYear = setting.activeAcademicYear;
          if (setting.nextAcademicYear) this.nextAcademicYear = setting.nextAcademicYear;

          if (setting.availableAcademicYears) {
            this.sessionsList = setting.availableAcademicYears
              .split(',')
              .map(s => s.trim())
              .filter(s => s.length > 0);
          }
          if (!this.sessionsList.includes(this.activeAcademicYear)) {
            this.sessionsList.unshift(this.activeAcademicYear);
          }

          if (setting.availableExamTypes) {
            this.examTypesList = setting.availableExamTypes
              .split(',')
              .map(t => t.trim())
              .filter(t => t.length > 0);
          }

          this.evaluationDueDays = setting.evaluationDueDays || 7;
          this.passingPercentage = setting.passingPercentage || 33;
          this.maxCompartmentSubjects = setting.maxCompartmentSubjects ?? 2;
          this.allowGraceMarks = setting.allowGraceMarks ?? true;
          this.maxGraceMarks = setting.maxGraceMarks ?? 5;
          this.schoolAffiliationNumber = setting.schoolAffiliationNumber || 'CBSE/STATE-AFF-2025';
          this.principalSignTitle = setting.principalSignTitle || 'Principal / Headmaster';
          this.classTeacherSignTitle = setting.classTeacherSignTitle || 'Class Teacher';
          this.resultDeclarationNote = setting.resultDeclarationNote || 'Continuous and Comprehensive Evaluation Scheme';
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  addSession(): void {
    const s = this.newSessionInput.trim();
    if (!s) return;
    if (!this.sessionsList.includes(s)) {
      this.sessionsList.push(s);
      this.sessionsList.sort();
    }
    this.newSessionInput = '';
  }

  removeSession(session: string): void {
    if (session === this.activeAcademicYear) {
      this.confirmDialog.alert('Cannot Remove Active Session', 'The currently active session cannot be removed. Please set another session as active first.', 'warning');
      return;
    }
    this.sessionsList = this.sessionsList.filter(s => s !== session);
    if (this.nextAcademicYear === session) {
      this.nextAcademicYear = this.sessionsList.find(s => s !== this.activeAcademicYear) || this.activeAcademicYear;
    }
  }

  addExamType(): void {
    const t = this.newExamTypeInput.trim();
    if (!t) return;
    if (!this.examTypesList.includes(t)) {
      this.examTypesList.push(t);
    }
    this.newExamTypeInput = '';
  }

  removeExamType(type: string): void {
    if (this.examTypesList.length <= 1) {
      this.confirmDialog.alert('Minimum Limit', 'At least one examination type must be configured.', 'warning');
      return;
    }
    this.examTypesList = this.examTypesList.filter(t => t !== type);
  }

  saveSettings(): void {
    if (!this.activeAcademicYear) {
      this.confirmDialog.alert('Validation Error', 'Active Academic Session is required.', 'warning');
      return;
    }

    this.saving = true;
    const payload: UpdateExamSettingDto = {
      activeAcademicYear: this.activeAcademicYear,
      nextAcademicYear: this.nextAcademicYear,
      availableAcademicYears: this.sessionsList.join(','),
      availableExamTypes: this.examTypesList.join(','),
      evaluationDueDays: this.evaluationDueDays > 0 ? this.evaluationDueDays : 7,
      passingPercentage: this.passingPercentage > 0 ? this.passingPercentage : 33,
      maxCompartmentSubjects: this.maxCompartmentSubjects >= 0 ? this.maxCompartmentSubjects : 2,
      allowGraceMarks: this.allowGraceMarks,
      maxGraceMarks: this.maxGraceMarks >= 0 ? this.maxGraceMarks : 5,
      schoolAffiliationNumber: this.schoolAffiliationNumber,
      principalSignTitle: this.principalSignTitle,
      classTeacherSignTitle: this.classTeacherSignTitle,
      resultDeclarationNote: this.resultDeclarationNote
    };

    this.schoolService.updateExamSettings(payload).subscribe({
      next: () => {
        this.saving = false;
        this.confirmDialog.alert(
          'Configurations Saved! ✅',
          `Academic session [${this.activeAcademicYear}], exam types, and evaluation rules have been successfully applied across the entire ERP.`,
          'success'
        );
      },
      error: (err) => {
        this.saving = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Could not save workflow settings.', 'danger');
      }
    });
  }
}
