import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CoachingService, ResequenceRollNumbersResultDto, StudentRollNumberPreviewItemDto } from '../../core/services/coaching.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface RollSequencerDialogData {
  schoolClasses?: any[];
  batches?: any[];
  selectedClassId?: string;
  selectedSectionId?: string;
  selectedBatchId?: string;
  initialScope?: 'school' | 'coaching';
}

@Component({
  selector: 'app-student-roll-sequencer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatChipsModule,
    MatSlideToggleModule
  ],
  template: `
<div class="sequencer-wrap">
  <!-- AGENTS.md STRICT LIGHT BLUE GRADIENT HEADER -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>{{ targetScope === 'coaching' ? 'school' : 'format_list_numbered' }}</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">
          {{ targetScope === 'coaching' ? 'Coaching Batch Roll Sequencer' : 'Class Roll Number Auto-Sequencer' }}
          <span class="hindi-title">({{ targetScope === 'coaching' ? 'कोचिंग बैच रोल नंबर ऑटो-सीक्वेंसिंग' : 'कक्षा रोल नंबर री-सीक्वेंसिंग' }})</span>
        </h2>
        <p class="modal-subtitle">
          Auto-generate and sequence roll numbers &bull;
          <strong style="color: #1e40af;">Official Session &amp; Exam Alignment</strong>
        </p>
      </div>
    </div>
    <div class="header-actions">
      <button mat-icon-button (click)="dialogRef.close(hasAppliedChanges)" class="close-btn" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading || applying" class="header-progress"></mat-progress-bar>

  <div class="modal-body">
    <!-- Scope Switcher Pill Tabs -->
    <div class="scope-nav-container">
      <div class="scope-pills">
        <button
          type="button"
          class="scope-pill-btn"
          [class.active]="targetScope === 'school'"
          (click)="setScope('school')">
          <mat-icon class="pill-icon">account_balance</mat-icon>
          <span>School Classes (स्कूल कक्षाएं)</span>
        </button>

        <button
          type="button"
          class="scope-pill-btn"
          [class.active]="targetScope === 'coaching'"
          (click)="setScope('coaching')">
          <mat-icon class="pill-icon">groups</mat-icon>
          <span>Coaching Batches (कोचिंग बैचेस)</span>
        </button>
      </div>

      <div class="scope-meta-badge">
        <mat-icon>verified_user</mat-icon>
        <span *ngIf="targetScope === 'coaching'">Target: <strong>Coaching Roll Number</strong> (बैच रोल नंबर)</span>
        <span *ngIf="targetScope === 'school'">Target: <strong>School Roll Number</strong> (कक्षा रोल नंबर)</span>
      </div>
    </div>

    <!-- Configuration Controls Card -->
    <div class="config-card">
      <!-- Target Selection Row -->
      <div class="config-row-primary" [class.coaching-grid]="targetScope === 'coaching'" [class.school-grid]="targetScope === 'school'">
        <!-- School Scope Controls -->
        <ng-container *ngIf="targetScope === 'school'">
          <mat-form-field appearance="outline" class="form-item class-select-field">
            <mat-label>School Class *</mat-label>
            <mat-select [(ngModel)]="classId" (selectionChange)="onClassChange($event.value)">
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                {{ c.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-item section-select-field">
            <mat-label>Section (Optional)</mat-label>
            <mat-select [(ngModel)]="sectionId" (selectionChange)="onSectionChange()">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of availableSections" [value]="s.id">
                Section {{ s.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Coaching Scope Controls -->
        <ng-container *ngIf="targetScope === 'coaching'">
          <mat-form-field appearance="outline" class="form-item class-select-field">
            <mat-label>Target Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="coachingClassId" (selectionChange)="onCoachingClassChange($event.value)">
              <mat-option value="">All Classes (सभी कक्षाएं)</mat-option>
              <mat-option *ngFor="let c of schoolClasses" [value]="c.id">
                {{ c.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-item batch-select-field">
            <mat-label>Coaching Batch * (कोचिंग बैच)</mat-label>
            <mat-select [(ngModel)]="batchId" (selectionChange)="onBatchChange($event.value)" [disabled]="filteredBatches.length === 0">
              <mat-option *ngIf="filteredBatches.length === 0" [value]="''" disabled>
                No batches found for this class
              </mat-option>
              <mat-option *ngFor="let b of filteredBatches" [value]="b.id">
                <strong>{{ b.name }}</strong>
                <span class="batch-opt-meta">({{ b.className ? b.className + ' &bull; ' : '' }}{{ b.subject || 'All Subjects' }} &bull; {{ b.studentCount || 0 }} Students)</span>
              </mat-option>
            </mat-select>
          </mat-form-field>
        </ng-container>

        <!-- Start From -->
        <mat-form-field appearance="outline" class="form-item num-field">
          <mat-label>Start Number</mat-label>
          <input matInput type="number" [(ngModel)]="startFrom" min="1" (change)="clearPreview()" />
          <span matSuffix class="field-suffix">e.g. 1</span>
        </mat-form-field>

        <!-- Digits Padding: FULL WIDTH -->
        <mat-form-field appearance="outline" class="form-item padding-field">
          <mat-label>Digits Format / Padding (अंक प्रारूप)</mat-label>
          <mat-select [(ngModel)]="numberPadding" (selectionChange)="clearPreview()">
            <mat-option [value]="1">1 Digit &mdash; 1, 2, 3, 4... (Normal No Zeroes)</mat-option>
            <mat-option [value]="2">2 Digits &mdash; 01, 02, 03... (Standard Coaching)</mat-option>
            <mat-option [value]="3">3 Digits &mdash; 001, 002, 003... (Large Mock Test / OMR)</mat-option>
            <mat-option [value]="4">4 Digits &mdash; 0001, 0002... (Mega Institute)</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Prefix & Pattern Row: Vertically Centered -->
      <div class="config-row-secondary">
        <mat-form-field appearance="outline" class="prefix-input-field" subscriptSizing="dynamic">
          <mat-label>Custom Prefix or Pattern (Optional)</mat-label>
          <input
            matInput
            type="text"
            [(ngModel)]="prefix"
            placeholder="e.g. {BATCH}- or B1- or NEET26-"
            (input)="clearPreview()" />
          <button *ngIf="prefix" matSuffix mat-icon-button (click)="prefix = ''; clearPreview()" matTooltip="Clear Prefix">
            <mat-icon>clear</mat-icon>
          </button>
        </mat-form-field>

        <!-- Dynamic Token Helper Chips: Vertically Centered -->
        <div class="token-helper-wrap">
          <span class="token-label">Dynamic Tokens:</span>
          <div class="token-chips-group">
            <button
              type="button"
              class="token-chip-btn"
              (click)="insertToken('{BATCH}')"
              matTooltip="Inserts dynamic Batch Name/Code into Prefix"
              *ngIf="targetScope === 'coaching'">
              +&#123;BATCH&#125;
            </button>
            <button
              type="button"
              class="token-chip-btn"
              (click)="insertToken('{CLASS}')"
              matTooltip="Inserts dynamic Class Name into Prefix"
              *ngIf="targetScope === 'school' || (targetScope === 'coaching' && coachingClassId)">
              +&#123;CLASS&#125;
            </button>
            <button
              type="button"
              class="token-chip-btn"
              (click)="insertToken('{BRANCH}')"
              matTooltip="Inserts active Branch Code into Prefix">
              +&#123;BRANCH&#125;
            </button>
            <button
              type="button"
              class="token-chip-btn"
              (click)="insertToken('{YEAR}')"
              matTooltip="Inserts Session Year into Prefix">
              +&#123;YEAR&#125;
            </button>
          </div>
        </div>

        <!-- Mode Toggle: Fresh Resequencing vs Fill Blanks Only -->
        <div class="mode-toggle-wrap">
          <mat-slide-toggle
            [(ngModel)]="fillBlanksOnly"
            (change)="clearPreview()"
            color="primary">
            <span class="toggle-text">
              <strong>Fill Blanks Only</strong>
              <small class="toggle-hint">(केवल नए छात्रों को रोल नंबर दें, पुराने सुरक्षित रखें)</small>
            </span>
          </mat-slide-toggle>
        </div>
      </div>

      <!-- Sorting Rule Selector -->
      <div class="sort-rule-section">
        <div class="rule-label">
          <mat-icon>sort</mat-icon>
          <span>Choose Sequencing Rule (सीक्वेंसिंग नियम):</span>
        </div>
        <div class="rule-grid">
          <label class="rule-pill" [class.selected]="sortRule === 'alphabetical'">
            <input type="radio" name="sortRule" value="alphabetical" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🔤 Alphabetical (A to Z)</span>
              <span class="pill-desc">Sorted by student first name from A to Z</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'admission_date'">
            <input type="radio" name="sortRule" value="admission_date" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">📅 By Admission Date (Seniority FIFO)</span>
              <span class="pill-desc">Earliest joining students receive roll 1, 2...</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'admission_no'">
            <input type="radio" name="sortRule" value="admission_no" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🔢 By Admission / SR Number</span>
              <span class="pill-desc">Sorted sequentially by official Registration No.</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'gender_alphabetical'">
            <input type="radio" name="sortRule" value="gender_alphabetical" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🚻 Girls First (A-Z), Then Boys (A-Z)</span>
              <span class="pill-desc">Standard CBSE / State school roll call format</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'current_roll'">
            <input type="radio" name="sortRule" value="current_roll" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🔄 Re-Pack Existing Order (Fill Gaps)</span>
              <span class="pill-desc">Keep current sequence but remove gaps from left students</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="config-actions">
        <button
          mat-stroked-button
          color="primary"
          class="preview-btn"
          (click)="loadPreview()"
          [disabled]="isGenerateDisabled() || loading">
          <mat-icon>visibility</mat-icon>
          <span>Generate Preview (पूर्वावलोकन)</span>
        </button>

        <button
          mat-raised-button
          color="primary"
          class="apply-btn"
          (click)="applySequencing()"
          [disabled]="!previewResult || previewResult.students.length === 0 || loading || applying">
          <mat-icon>{{ applying ? 'hourglass_top' : 'check_circle' }}</mat-icon>
          <span>{{ applying ? 'Applying to Database...' : 'Apply & Save Roll Numbers (' + (previewResult?.students?.length || 0) + ' Students)' }}</span>
        </button>
      </div>
    </div>

    <!-- Preview Results Area -->
    <div class="preview-area" *ngIf="previewResult">
      <div class="preview-header">
        <div class="preview-title">
          <mat-icon>checklist</mat-icon>
          <span>
            Roll Numbers Preview:
            <strong>{{ previewResult.totalStudents }} Students Found</strong>
            <span class="preview-scope-tag">({{ targetScope === 'coaching' ? 'Coaching Batch' : 'School Class' }})</span>
          </span>
        </div>
        <div class="preview-header-right">
          <span class="stats-pill" *ngIf="previewResult.students.length > 0">
            <span class="changed-count">{{ getChangedCount() }} to update</span> &bull;
            <span class="unchanged-count">{{ getUnchangedCount() }} unchanged</span>
          </span>
          <div class="preview-badge" *ngIf="hasAppliedChanges">
            <mat-icon>verified</mat-icon> Saved to Database
          </div>
        </div>
      </div>

      <div class="table-responsive" *ngIf="previewResult.students.length > 0">
        <table class="preview-table">
          <thead>
            <tr>
              <th style="width: 45px;">#</th>
              <th>Student Name</th>
              <th>Admission / SR No</th>
              <th>Gender</th>
              <th style="width: 140px; text-align: center;">Current Roll</th>
              <th style="width: 40px; text-align: center;">→</th>
              <th style="width: 150px; text-align: center;">New Roll Number</th>
              <th style="width: 110px; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let item of previewResult.students; let idx = index"
              [class.changed]="item.status === 'Updated' || (item.status === 'New Assigned')"
              [class.unchanged]="item.status === 'Unchanged'">
              <td class="col-idx">{{ idx + 1 }}</td>
              <td class="col-name">
                <strong>{{ item.studentName }}</strong>
              </td>
              <td class="col-adm">
                <span class="adm-chip">{{ item.admissionNumber || '—' }}</span>
              </td>
              <td class="col-gender">
                <span class="gender-chip" [class.female]="item.gender === 'Female' || item.gender === 'Girl'">
                  {{ item.gender || '—' }}
                </span>
              </td>
              <td class="col-old-roll">
                <span class="old-roll-chip">{{ item.currentRollNumber || 'None' }}</span>
              </td>
              <td class="col-arrow">
                <mat-icon class="arrow-icon">arrow_forward</mat-icon>
              </td>
              <td class="col-new-roll">
                <span class="new-roll-chip" [class.highlight]="item.status !== 'Unchanged'">
                  {{ item.newRollNumber }}
                </span>
              </td>
              <td class="col-status">
                <span class="status-chip" [ngClass]="item.status?.toLowerCase()?.replace(' ', '-') || 'updated'">
                  {{ item.status || 'Updated' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-preview" *ngIf="previewResult.students.length === 0">
        <mat-icon>info</mat-icon>
        <p>No active students found in this {{ targetScope === 'coaching' ? 'coaching batch' : 'class/section' }} to sequence.</p>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .sequencer-wrap {
      display: flex;
      flex-direction: column;
      max-height: 90vh;
      overflow: hidden;
      font-family: inherit;
    }

    /* AGENTS.md light blue gradient dialog header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
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
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .header-icon-box mat-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .modal-title {
      color: #1e3a8a;
      font-weight: 700;
      font-size: 1.15rem;
      margin: 0;
      line-height: 1.25;
    }

    .hindi-title {
      font-size: 0.95rem;
      font-weight: 600;
      color: #2563eb;
      margin-left: 6px;
    }

    .modal-subtitle {
      color: #3b82f6;
      font-size: 0.82rem;
      margin: 3px 0 0;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.2s;
    }
    .close-btn:hover {
      color: #1e293b;
    }

    .header-progress {
      margin-top: -4px;
      flex-shrink: 0;
    }

    .modal-body {
      padding: 18px 24px 24px;
      overflow-y: auto;
      max-height: calc(90vh - 80px);
      background: #f8fafc;
      box-sizing: border-box;
    }

    /* Scope Switcher Pill Tabs */
    .scope-nav-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .scope-pills {
      display: inline-flex;
      background: #e2e8f0;
      padding: 4px;
      border-radius: 10px;
      gap: 4px;
    }

    .scope-pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      background: transparent;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .scope-pill-btn:hover {
      color: #1e293b;
    }

    .scope-pill-btn.active {
      background: #ffffff;
      color: #2563eb;
      box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    }

    .pill-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .scope-meta-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.78rem;
      color: #1e40af;
      background: #dbeafe;
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
    }

    .scope-meta-badge mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #2563eb;
    }

    /* Configuration Card */
    .config-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      margin-bottom: 20px;
    }

    .config-row-primary {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 14px;
      align-items: center;
    }

    .config-row-primary.school-grid {
      grid-template-columns: 1.5fr 1.2fr 1fr;
    }

    .config-row-primary.coaching-grid {
      grid-template-columns: 1.2fr 1.8fr 1fr;
    }

    .batch-select-field {
      grid-column: span 1;
    }

    /* Digit format dropdown: FULL WIDTH */
    .padding-field {
      grid-column: 1 / -1 !important;
      width: 100% !important;
      margin-top: 2px;
    }

    .batch-opt-meta {
      font-size: 0.8rem;
      color: #64748b;
      margin-left: 6px;
    }

    .field-suffix {
      font-size: 11px;
      color: #64748b;
      margin-right: 6px;
    }

    /* Vertically centered second row */
    .config-row-secondary {
      display: flex;
      align-items: center;
      gap: 18px;
      margin-top: 6px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
      flex-wrap: wrap;
    }

    .prefix-input-field {
      flex: 1 1 260px;
      margin-bottom: 0;
    }

    .token-helper-wrap {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 8px;
      flex: 0 1 auto;
    }

    .token-label {
      font-size: 0.76rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .token-chips-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .token-chip-btn {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      font-size: 0.78rem;
      font-weight: 600;
      font-family: monospace;
      padding: 5px 9px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1.2;
      transition: all 0.15s;
    }

    .token-chip-btn:hover {
      background: #2563eb;
      color: #ffffff;
      border-color: #2563eb;
    }

    .mode-toggle-wrap {
      display: flex;
      align-items: center;
      margin-left: auto;
    }

    .toggle-text {
      display: flex;
      flex-direction: column;
      font-size: 0.84rem;
      color: #1e293b;
    }

    .toggle-hint {
      font-size: 0.72rem;
      color: #64748b;
    }

    /* Sequencing Rule Section */
    .sort-rule-section {
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
    }

    .rule-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
    }

    .rule-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #2563eb;
    }

    .rule-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 10px;
    }

    .rule-pill {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .rule-pill:hover {
      background: #eff6ff;
      border-color: #93c5fd;
    }

    .rule-pill.selected {
      background: #eff6ff;
      border-color: #2563eb;
      box-shadow: 0 0 0 1px #2563eb;
    }

    .rule-pill input[type="radio"] {
      margin-top: 3px;
      accent-color: #2563eb;
      cursor: pointer;
    }

    .pill-content {
      display: flex;
      flex-direction: column;
    }

    .pill-title {
      font-size: 0.84rem;
      font-weight: 600;
      color: #0f172a;
    }

    .pill-desc {
      font-size: 0.74rem;
      color: #64748b;
      margin-top: 2px;
      line-height: 1.3;
    }

    .config-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
      flex-wrap: wrap;
    }

    .preview-btn {
      font-weight: 600;
    }

    .apply-btn {
      background: #16a34a !important;
      color: #ffffff !important;
      font-weight: 600;
    }

    /* Preview Table Area */
    .preview-area {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }

    .preview-header {
      padding: 12px 18px;
      background: #f1f5f9;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    .preview-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: #1e293b;
    }

    .preview-title mat-icon {
      color: #2563eb;
    }

    .preview-scope-tag {
      font-size: 0.8rem;
      color: #2563eb;
      font-weight: 600;
      margin-left: 4px;
    }

    .preview-header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .stats-pill {
      font-size: 0.78rem;
      background: #e2e8f0;
      padding: 4px 10px;
      border-radius: 12px;
      color: #334155;
    }

    .changed-count {
      color: #15803d;
      font-weight: 600;
    }

    .unchanged-count {
      color: #64748b;
    }

    .preview-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #dcfce7;
      color: #15803d;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 20px;
    }

    .preview-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Responsive Table Wrap */
    .table-responsive {
      max-height: 380px;
      overflow-x: auto;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .preview-table th {
      position: sticky;
      top: 0;
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      padding: 10px 14px;
      border-bottom: 2px solid #e2e8f0;
      z-index: 2;
    }

    .preview-table td {
      padding: 8px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .preview-table tr.changed {
      background: #f0fdf4;
    }

    .preview-table tr:hover {
      background: #f8fafc;
    }

    .col-idx {
      color: #94a3b8;
      font-weight: 500;
    }

    .col-name strong {
      color: #0f172a;
    }

    .adm-chip {
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.8rem;
    }

    .gender-chip {
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .gender-chip.female {
      background: #fce7f3;
      color: #be185d;
    }

    .old-roll-chip {
      background: #f1f5f9;
      color: #64748b;
      padding: 3px 10px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }

    .arrow-icon {
      color: #94a3b8;
      font-size: 18px;
      width: 18px;
      height: 18px;
      vertical-align: middle;
    }

    .new-roll-chip {
      background: #eff6ff;
      color: #2563eb;
      border: 1px solid #bfdbfe;
      padding: 3px 12px;
      border-radius: 6px;
      font-weight: 700;
      display: inline-block;
    }

    .new-roll-chip.highlight {
      background: #dcfce7;
      color: #15803d;
      border-color: #86efac;
    }

    .status-chip {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: capitalize;
    }

    .status-chip.updated {
      background: #dcfce7;
      color: #15803d;
    }

    .status-chip.unchanged {
      background: #f1f5f9;
      color: #64748b;
    }

    .status-chip.new-assigned {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .empty-preview {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      color: #94a3b8;
    }

    .empty-preview mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      margin-bottom: 8px;
    }

    /* 100% RESPONSIVE ADAPTATIONS */
    @media (max-width: 1024px) {
      .config-row-secondary {
        gap: 14px;
      }
      .mode-toggle-wrap {
        margin-left: 0;
        width: 100%;
        justify-content: flex-start;
      }
      .batch-select-field {
        grid-column: span 1;
      }
    }

    @media (max-width: 640px) {
      .modal-header {
        padding: 12px 16px;
      }
      .header-icon-box {
        width: 36px;
        height: 36px;
      }
      .header-icon-box mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .modal-title {
        font-size: 1rem;
      }
      .hindi-title {
        display: block;
        margin-left: 0;
        font-size: 0.85rem;
      }
      .modal-body {
        padding: 12px 14px 20px;
      }
      .scope-nav-container {
        flex-direction: column;
        align-items: stretch;
      }
      .scope-pills {
        display: flex;
        width: 100%;
      }
      .scope-pill-btn {
        flex: 1;
        justify-content: center;
        padding: 8px;
        font-size: 0.8rem;
      }
      .config-card {
        padding: 14px;
      }
      .config-row-primary,
      .config-row-primary.school-grid,
      .config-row-primary.coaching-grid {
        grid-template-columns: 1fr !important;
      }
      .batch-select-field {
        grid-column: span 1 !important;
      }
      .config-row-secondary {
        flex-direction: column;
        align-items: stretch;
        gap: 12px;
      }
      .token-helper-wrap {
        flex-wrap: wrap;
      }
      .mode-toggle-wrap {
        margin-left: 0;
        width: 100%;
      }
      .rule-grid {
        grid-template-columns: 1fr;
      }
      .config-actions {
        flex-direction: column;
        width: 100%;
      }
      .preview-btn, .apply-btn {
        width: 100%;
        justify-content: center;
      }
    }
  `]
})
export class StudentRollSequencerDialogComponent implements OnInit {
  targetScope: 'school' | 'coaching' = 'school';

  // School filters
  classId: string = '';
  sectionId: string = '';
  availableSections: any[] = [];
  schoolClasses: any[] = [];

  // Coaching filters
  coachingClassId: string = '';
  batchId: string = '';
  batches: any[] = [];
  filteredBatches: any[] = [];

  // Common sequencing parameters
  startFrom: number = 1;
  numberPadding: number = 1;
  prefix: string = '';
  sortRule: string = 'alphabetical';
  fillBlanksOnly: boolean = false;

  loading = false;
  applying = false;
  hasAppliedChanges = false;
  previewResult: ResequenceRollNumbersResultDto | null = null;

  constructor(
    public dialogRef: MatDialogRef<StudentRollSequencerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RollSequencerDialogData,
    private coachingService: CoachingService,
    private schoolService: SchoolService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.schoolClasses = this.data?.schoolClasses ? [...this.data.schoolClasses] : [];
    this.batches = this.data?.batches ? [...this.data.batches] : [];

    // Set initial scope if requested
    if (this.data?.initialScope) {
      this.targetScope = this.data.initialScope;
    } else if (this.data?.selectedBatchId && !this.data?.selectedClassId) {
      this.targetScope = 'coaching';
    }

    if (this.data?.selectedClassId) {
      this.classId = this.data.selectedClassId;
      this.coachingClassId = this.data.selectedClassId;
      this.onClassChange(this.classId);
    }
    if (this.data?.selectedSectionId) {
      this.sectionId = this.data.selectedSectionId;
    }
    if (this.data?.selectedBatchId) {
      this.batchId = this.data.selectedBatchId;
    }

    // 1. Load School Classes if not provided or empty
    if (this.schoolClasses.length === 0) {
      this.schoolService.getClasses(true).subscribe({
        next: (classes) => {
          this.schoolClasses = classes || [];
          if (this.targetScope === 'school' && !this.classId && this.schoolClasses.length > 0) {
            this.classId = this.schoolClasses[0].id;
            this.onClassChange(this.classId);
            this.loadPreview();
          }
          if (this.targetScope === 'coaching') {
            this.syncCoachingContext();
          }
        },
        error: (err) => {
          console.error('Failed to load school classes for roll sequencer:', err);
        }
      });
    } else {
      if (this.targetScope === 'school' && !this.classId && this.schoolClasses.length > 0) {
        this.classId = this.schoolClasses[0].id;
        this.onClassChange(this.classId);
      }
    }

    // 2. Load Coaching Batches (fetch all batches from API if empty or paginated slice)
    if (this.batches.length === 0 || this.batches.length <= 10) {
      this.coachingService.getBatches().subscribe({
        next: (res) => {
          this.batches = res || [];
          this.syncCoachingContext();
        },
        error: () => {
          this.syncCoachingContext();
        }
      });
    } else {
      this.syncCoachingContext();
    }

    // Auto-load preview if target is already specified
    if ((this.targetScope === 'school' && this.classId) || (this.targetScope === 'coaching' && this.batchId)) {
      this.loadPreview();
    }
  }

  syncCoachingContext(): void {
    if (this.batchId && !this.coachingClassId) {
      const matched = this.batches.find(b => this.isSameId(b.id, this.batchId));
      if (matched?.classId) {
        this.coachingClassId = matched.classId;
      }
    }
    this.applyBatchFilter();
  }

  applyBatchFilter(): void {
    if (!this.coachingClassId) {
      this.filteredBatches = [...this.batches];
    } else {
      this.filteredBatches = this.batches.filter(b => this.isSameId(b.classId, this.coachingClassId));
    }

    // If currently selected batchId is not in filteredBatches
    if (this.batchId && !this.filteredBatches.some(b => this.isSameId(b.id, this.batchId))) {
      if (this.filteredBatches.length > 0) {
        this.batchId = this.filteredBatches[0].id;
        this.clearPreview();
        if (this.targetScope === 'coaching') {
          this.loadPreview();
        }
      } else {
        this.batchId = '';
        this.clearPreview();
      }
    } else if (!this.batchId && this.filteredBatches.length > 0) {
      this.batchId = this.filteredBatches[0].id;
      this.clearPreview();
      if (this.targetScope === 'coaching') {
        this.loadPreview();
      }
    }
  }

  onCoachingClassChange(classId: string): void {
    this.coachingClassId = classId;
    this.applyBatchFilter();
  }

  private isSameId(a: any, b: any): boolean {
    if (!a || !b) return false;
    return a.toString().toLowerCase() === b.toString().toLowerCase();
  }

  setScope(scope: 'school' | 'coaching'): void {
    if (this.targetScope === scope) return;
    this.targetScope = scope;
    this.clearPreview();

    // Adjust defaults appropriately for scope
    if (scope === 'coaching') {
      this.applyBatchFilter();
      if (!this.batchId && this.filteredBatches.length > 0) {
        this.batchId = this.filteredBatches[0].id;
      }
      if (this.numberPadding === 1) {
        this.numberPadding = 2; // 2 digits is standard in coaching (01, 02..)
      }
      if (this.batchId) {
        this.loadPreview();
      }
    } else {
      if (!this.classId && this.schoolClasses.length > 0) {
        this.classId = this.schoolClasses[0].id;
        this.onClassChange(this.classId);
      } else if (this.classId) {
        this.loadPreview();
      }
    }
  }

  onClassChange(selectedId: string): void {
    this.clearPreview();
    const selClass = (this.schoolClasses || []).find(c => this.isSameId(c.id, selectedId));
    this.availableSections = selClass?.sections || [];
    this.sectionId = '';
    if (this.classId) {
      this.loadPreview();
    }
  }

  onSectionChange(): void {
    this.clearPreview();
    if (this.classId) {
      this.loadPreview();
    }
  }

  onBatchChange(selectedBatchId: string): void {
    this.batchId = selectedBatchId;
    this.clearPreview();
    if (this.batchId) {
      this.loadPreview();
    }
  }

  insertToken(token: string): void {
    this.clearPreview();
    const cur = this.prefix || '';
    if (!cur.includes(token)) {
      this.prefix = cur ? `${cur}${token}` : token;
    }
  }

  clearPreview(): void {
    this.previewResult = null;
  }

  isGenerateDisabled(): boolean {
    if (this.targetScope === 'school') {
      return !this.classId;
    }
    return !this.batchId;
  }

  getChangedCount(): number {
    if (!this.previewResult) return 0;
    return this.previewResult.students.filter(s => s.status !== 'Unchanged').length;
  }

  getUnchangedCount(): number {
    if (!this.previewResult) return 0;
    return this.previewResult.students.filter(s => s.status === 'Unchanged').length;
  }

  loadPreview(): void {
    if (this.isGenerateDisabled()) return;

    this.loading = true;
    this.coachingService.resequenceRollNumbers({
      targetScope: this.targetScope,
      classId: this.targetScope === 'school' ? (this.classId || undefined) : undefined,
      sectionId: this.targetScope === 'school' ? (this.sectionId || undefined) : undefined,
      batchId: this.targetScope === 'coaching' ? (this.batchId || undefined) : undefined,
      sortRule: this.sortRule,
      startFrom: this.startFrom || 1,
      prefix: this.prefix || '',
      numberPadding: this.numberPadding || 1,
      fillBlanksOnly: this.fillBlanksOnly,
      isDryRun: true
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.previewResult = res;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Error', this.extractErrorMessage(err, 'Failed to generate roll numbers preview.'), 'danger');
      }
    });
  }

  applySequencing(): void {
    if (this.isGenerateDisabled() || !this.previewResult || this.previewResult.students.length === 0) return;

    const count = this.previewResult.students.length;
    const targetLabel = this.targetScope === 'coaching' ? 'Coaching Batch' : 'School Class';

    this.confirmDialog.confirm(
      'Confirm Roll Number Sequencing',
      `Are you sure you want to apply and save roll numbers for ${count} students in this ${targetLabel}? ` +
      (this.fillBlanksOnly ? 'Existing roll numbers will be preserved; only unassigned students will receive new numbers.' : 'Roll numbers will be updated according to your configured rule.'),
      'Yes, Apply New Roll Numbers',
      'Cancel',
      'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.applying = true;
      this.coachingService.resequenceRollNumbers({
        targetScope: this.targetScope,
        classId: this.targetScope === 'school' ? (this.classId || undefined) : undefined,
        sectionId: this.targetScope === 'school' ? (this.sectionId || undefined) : undefined,
        batchId: this.targetScope === 'coaching' ? (this.batchId || undefined) : undefined,
        sortRule: this.sortRule,
        startFrom: this.startFrom || 1,
        prefix: this.prefix || '',
        numberPadding: this.numberPadding || 1,
        fillBlanksOnly: this.fillBlanksOnly,
        isDryRun: false
      }).subscribe({
        next: (res) => {
          this.applying = false;
          this.hasAppliedChanges = true;
          this.previewResult = res;
          this.confirmDialog.alert(
            'Success',
            `Successfully saved roll numbers for ${res.updatedCount} students in ${targetLabel}!`,
            'success'
          );
        },
        error: (err) => {
          this.applying = false;
          this.confirmDialog.alert('Error', this.extractErrorMessage(err, 'Failed to apply roll numbers to database.'), 'danger');
        }
      });
    });
  }

  private extractErrorMessage(err: any, fallback: string): string {
    if (err?.error?.message) return err.error.message;
    if (err?.error?.errors && typeof err.error.errors === 'object') {
      const messages = Object.values(err.error.errors).flat();
      if (messages.length > 0) return messages.join('; ');
    }
    if (typeof err?.error === 'string' && err.error.trim().length > 0) return err.error;
    if (err?.statusText && err.statusText !== 'OK') return `${err.statusText} (${err.status})`;
    return fallback;
  }
}
