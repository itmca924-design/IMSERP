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
import { CoachingService, ResequenceRollNumbersResultDto, StudentRollNumberPreviewItemDto } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface RollSequencerDialogData {
  schoolClasses: any[];
  selectedClassId?: string;
  selectedSectionId?: string;
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
    MatRadioModule
  ],
  template: `
<div class="sequencer-wrap">
  <!-- AGENTS.md STRICT LIGHT BLUE GRADIENT HEADER -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>format_list_numbered</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">Class Roll Number Auto-Sequencer (रोल नंबर री-सीक्वेंसिंग)</h2>
        <p class="modal-subtitle">
          Auto-generate and sequence class roll numbers &bull;
          <strong style="color: #1e40af;">Official Session Alignment</strong>
        </p>
      </div>
    </div>
    <div class="header-actions">
      <button mat-icon-button (click)="dialogRef.close(hasAppliedChanges)" class="close-btn" matTooltip="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading" class="header-progress"></mat-progress-bar>

  <div class="modal-body">
    <!-- Configuration Controls Card -->
    <div class="config-card">
      <div class="config-row">
        <!-- Class Selector -->
        <mat-form-field appearance="outline" class="form-item">
          <mat-label>School Class *</mat-label>
          <mat-select [(ngModel)]="classId" (selectionChange)="onClassChange($event.value)">
            <mat-option *ngFor="let c of data.schoolClasses" [value]="c.id">
              {{ c.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Section Selector -->
        <mat-form-field appearance="outline" class="form-item">
          <mat-label>Section (Optional)</mat-label>
          <mat-select [(ngModel)]="sectionId" (selectionChange)="clearPreview()">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let s of availableSections" [value]="s.id">
              Section {{ s.name }}
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Start Number -->
        <mat-form-field appearance="outline" class="form-item num-field">
          <mat-label>Start From</mat-label>
          <input matInput type="number" [(ngModel)]="startFrom" min="1" (change)="clearPreview()" />
          <span matSuffix style="font-size: 11px; color: #64748b; margin-right: 6px;">e.g. 1</span>
        </mat-form-field>

        <!-- Optional Prefix -->
        <mat-form-field appearance="outline" class="form-item prefix-field">
          <mat-label>Prefix (Optional)</mat-label>
          <input matInput type="text" [(ngModel)]="prefix" placeholder="e.g. R-" (input)="clearPreview()" />
        </mat-form-field>
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

          <label class="rule-pill" [class.selected]="sortRule === 'gender_alphabetical'">
            <input type="radio" name="sortRule" value="gender_alphabetical" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🚻 Girls First (A-Z), Then Boys (A-Z)</span>
              <span class="pill-desc">Standard CBSE / State school roll call format</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'admission_no'">
            <input type="radio" name="sortRule" value="admission_no" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">🔢 By Admission Number</span>
              <span class="pill-desc">Sorted sequentially by SR / Admission No.</span>
            </div>
          </label>

          <label class="rule-pill" [class.selected]="sortRule === 'admission_date'">
            <input type="radio" name="sortRule" value="admission_date" [(ngModel)]="sortRule" (change)="clearPreview()" />
            <div class="pill-content">
              <span class="pill-title">📅 By Admission Date</span>
              <span class="pill-desc">Earliest registered students receive roll 1, 2...</span>
            </div>
          </label>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="config-actions">
        <button mat-stroked-button color="primary" class="preview-btn" (click)="loadPreview()" [disabled]="!classId || loading">
          <mat-icon>visibility</mat-icon> Generate Preview (पूर्वावलोकन)
        </button>

        <button mat-raised-button color="primary" class="apply-btn" (click)="applySequencing()" [disabled]="!previewResult || previewResult.students.length === 0 || loading || applying">
          <mat-icon>{{ applying ? 'hourglass_top' : 'check_circle' }}</mat-icon>
          {{ applying ? 'Applying to Database...' : 'Apply & Save Roll Numbers (' + (previewResult?.students?.length || 0) + ' Students)' }}
        </button>
      </div>
    </div>

    <!-- Preview Results Area -->
    <div class="preview-area" *ngIf="previewResult">
      <div class="preview-header">
        <div class="preview-title">
          <mat-icon>checklist</mat-icon>
          <span>Roll Numbers Preview: <strong>{{ previewResult.totalStudents }} students found</strong></span>
        </div>
        <div class="preview-badge" *ngIf="hasAppliedChanges">
          <mat-icon>verified</mat-icon> Saved to Database
        </div>
      </div>

      <div class="table-container" *ngIf="previewResult.students.length > 0">
        <table class="preview-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Student Name</th>
              <th>Admission No</th>
              <th>Gender</th>
              <th style="width: 130px; text-align: center;">Current Roll</th>
              <th style="width: 40px; text-align: center;">→</th>
              <th style="width: 140px; text-align: center;">New Roll Number</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of previewResult.students; let idx = index" [class.changed]="item.currentRollNumber !== item.newRollNumber">
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
                <span class="new-roll-chip" [class.highlight]="item.currentRollNumber !== item.newRollNumber">
                  {{ item.newRollNumber }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-preview" *ngIf="previewResult.students.length === 0">
        <mat-icon>info</mat-icon>
        <p>No active students found in this class/section to sequence.</p>
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
    }

    /* AGENTS.md light blue gradient dialog header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
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
      line-height: 1.2;
    }

    .modal-subtitle {
      color: #3b82f6;
      font-size: 0.82rem;
      margin: 2px 0 0;
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
    }

    .modal-body {
      padding: 20px 24px;
      overflow-y: auto;
      max-height: calc(90vh - 80px);
      background: #f8fafc;
    }

    .config-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      margin-bottom: 20px;
    }

    .config-row {
      display: grid;
      grid-template-columns: 2fr 1.5fr 1fr 1fr;
      gap: 14px;
    }

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
      margin-bottom: 10px;
    }

    .rule-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #2563eb;
    }

    .rule-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
    }

    .pill-content {
      display: flex;
      flex-direction: column;
    }

    .pill-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #0f172a;
    }

    .pill-desc {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 2px;
    }

    .config-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 18px;
      padding-top: 14px;
      border-top: 1px solid #f1f5f9;
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

    .table-container {
      max-height: 380px;
      overflow-y: auto;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.85rem;
    }

    .preview-table th {
      position: sticky;
      top: 0;
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      padding: 10px 14px;
      border-bottom: 2px solid #e2e8f0;
      z-index: 1;
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
  `]
})
export class StudentRollSequencerDialogComponent implements OnInit {
  classId: string = '';
  sectionId: string = '';
  startFrom: number = 1;
  prefix: string = '';
  sortRule: string = 'alphabetical';

  availableSections: any[] = [];
  loading = false;
  applying = false;
  hasAppliedChanges = false;
  previewResult: ResequenceRollNumbersResultDto | null = null;

  constructor(
    public dialogRef: MatDialogRef<StudentRollSequencerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RollSequencerDialogData,
    private coachingService: CoachingService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    if (this.data.selectedClassId) {
      this.classId = this.data.selectedClassId;
      this.onClassChange(this.classId);
    }
    if (this.data.selectedSectionId) {
      this.sectionId = this.data.selectedSectionId;
    }
    if (this.classId) {
      this.loadPreview();
    }
  }

  onClassChange(selectedId: string): void {
    this.clearPreview();
    const selClass = (this.data.schoolClasses || []).find(c => c.id === selectedId);
    this.availableSections = selClass?.sections || [];
    this.sectionId = '';
  }

  clearPreview(): void {
    this.previewResult = null;
  }

  loadPreview(): void {
    if (!this.classId) return;

    this.loading = true;
    this.coachingService.resequenceRollNumbers({
      classId: this.classId,
      sectionId: this.sectionId || null,
      sortRule: this.sortRule,
      startFrom: this.startFrom || 1,
      prefix: this.prefix || '',
      isDryRun: true
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.previewResult = res;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert('Error', err?.error?.message || 'Failed to generate roll numbers preview.', 'danger');
      }
    });
  }

  applySequencing(): void {
    if (!this.classId || !this.previewResult || this.previewResult.students.length === 0) return;

    this.confirmDialog.confirm(
      'Confirm Roll Number Sequencing',
      `Are you sure you want to re-sequence and update roll numbers for ${this.previewResult.students.length} students in this class? Current roll numbers will be overwritten.`,
      'Yes, Apply New Roll Numbers',
      'Cancel',
      'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.applying = true;
      this.coachingService.resequenceRollNumbers({
        classId: this.classId,
        sectionId: this.sectionId || null,
        sortRule: this.sortRule,
        startFrom: this.startFrom || 1,
        prefix: this.prefix || '',
        isDryRun: false
      }).subscribe({
        next: (res) => {
          this.applying = false;
          this.hasAppliedChanges = true;
          this.previewResult = res;
          this.confirmDialog.alert('Success', `Successfully updated roll numbers for ${res.updatedCount} students!`, 'success');
        },
        error: (err) => {
          this.applying = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to apply roll numbers to database.', 'danger');
        }
      });
    });
  }
}
