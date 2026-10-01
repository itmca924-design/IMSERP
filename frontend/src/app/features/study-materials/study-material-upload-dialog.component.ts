import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StudyMaterialService } from './study-material.service';
import { StudyMaterialDto } from './study-material.models';

export interface StudyMaterialDialogData {
  material?: StudyMaterialDto | null;
  classes: any[];
  batches: any[];
  subjects: any[];
}

@Component({
  selector: 'app-study-material-upload-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-wrapper">
      <!-- Strict UI Rule Compliant Light-Blue Gradient Header -->
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEdit ? 'edit_note' : 'cloud_upload' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ isEdit ? 'Edit Study Material / PYQ' : 'Upload Study Material & PYQs' }}</h2>
          <p class="subtitle">
            Repository &bull; <strong>{{ form.materialType }}</strong> &bull; Target: <strong>{{ getScopeLabel(form.targetScope) }}</strong>
          </p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="dialogRef.close()" matTooltip="Close" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        <!-- 1. Target Scope Selector -->
        <div class="form-section-card">
          <div class="section-heading">
            <mat-icon>hub</mat-icon>
            <span>Target Audience &amp; Scope (Who can access this material?)</span>
          </div>

          <div class="scope-toggle-row">
            <button type="button" class="scope-chip-btn" [class.active]="form.targetScope === 'Both'" (click)="setScope('Both')">
              <mat-icon>public</mat-icon>
              <div class="chip-text">
                <strong>🌐 Open to All</strong>
                <small>School + Coaching Students</small>
              </div>
            </button>
            <button type="button" class="scope-chip-btn" [class.active]="form.targetScope === 'School'" (click)="setScope('School')">
              <mat-icon>school</mat-icon>
              <div class="chip-text">
                <strong>🏫 School Classes</strong>
                <small>Class 1st to 12th Syllabus</small>
              </div>
            </button>
            <button type="button" class="scope-chip-btn" [class.active]="form.targetScope === 'Coaching'" (click)="setScope('Coaching')">
              <mat-icon>psychology</mat-icon>
              <div class="chip-text">
                <strong>🎯 Coaching Batches</strong>
                <small>JEE, NEET, Foundation &amp; Droppers</small>
              </div>
            </button>
          </div>

          <!-- Scope Dynamic Filters (Class / Batch / Subject / Type) -->
          <div class="grid-2-cols" style="margin-top: 14px;">
            <!-- School Class (if School or Both) -->
            <mat-form-field appearance="outline" *ngIf="form.targetScope !== 'Coaching'">
              <mat-label>School Class (Optional)</mat-label>
              <mat-select [(ngModel)]="form.classId" (selectionChange)="onClassSelected()">
                <mat-option [value]="null">-- All Classes (General / Open) --</mat-option>
                <mat-option *ngFor="let c of data.classes" [value]="c.id">
                  {{ c.name }} <span class="opt-sub" *ngIf="c.code">({{ c.code }})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Coaching Batch (if Coaching or Both) -->
            <mat-form-field appearance="outline" *ngIf="form.targetScope !== 'School'">
              <mat-label>Coaching Batch (Optional)</mat-label>
              <mat-select [(ngModel)]="form.batchId">
                <mat-option [value]="null">-- All Batches (Open Competitive) --</mat-option>
                <mat-option *ngFor="let b of data.batches" [value]="b.id">
                  {{ b.name }} <span class="opt-sub" *ngIf="b.subject">({{ b.subject }})</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Subject -->
            <mat-form-field appearance="outline" [class.col-span-2]="form.targetScope === 'Both'">
              <mat-label>Teaching Subject *</mat-label>
              <mat-select [(ngModel)]="form.subject" required>
                <mat-option *ngFor="let s of data.subjects" [value]="s.name">
                  {{ s.name }} <span class="opt-sub" *ngIf="s.code">[{{ s.code }}]</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Material Type (Full Width across the card) -->
            <mat-form-field appearance="outline" class="col-span-2">
              <mat-label>Material Type *</mat-label>
              <mat-select [(ngModel)]="form.materialType" required>
                <mat-option value="Notes">📝 Theory &amp; Concept Notes (डिजिटल नोट्स)</mat-option>
                <mat-option value="PYQ">🎯 Previous Year Questions (PYQ Archive)</mat-option>
                <mat-option value="QuestionBank">📚 Question Bank / DPPs</mat-option>
                <mat-option value="FormulaSheet">⚡ Formula Sheet &amp; Mindmaps</mat-option>
                <mat-option value="SamplePaper">📄 Sample &amp; Model Papers</mat-option>
                <mat-option value="Syllabus">📌 Syllabus &amp; Blueprint</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- 2. Content Details -->
        <div class="form-section-card">
          <div class="section-heading">
            <mat-icon>article</mat-icon>
            <span>Content Information &amp; Academic Tagging</span>
          </div>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Document / Notes Title *</mat-label>
            <input matInput [(ngModel)]="form.title" placeholder="e.g. Class 10th Physics - Light Reflection Notes &amp; Formulas" required />
          </mat-form-field>

          <div class="grid-3-cols">
            <mat-form-field appearance="outline">
              <mat-label>Chapter Name (Optional)</mat-label>
              <input matInput [(ngModel)]="form.chapterName" placeholder="e.g. Chapter 4: Quadratic Equations" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Specific Topic (Optional)</mat-label>
              <input matInput [(ngModel)]="form.topic" placeholder="e.g. Ray Diagrams &amp; Mirror Formula" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Academic Year</mat-label>
              <input matInput [(ngModel)]="form.academicYear" placeholder="2026-27" />
            </mat-form-field>
          </div>

          <!-- Exam & PYQ Details -->
          <div class="grid-3-cols" *ngIf="form.materialType === 'PYQ' || form.materialType === 'QuestionBank' || form.targetScope === 'Coaching'">
            <mat-form-field appearance="outline">
              <mat-label>Target Exam</mat-label>
              <mat-select [(ngModel)]="form.targetExam">
                <mat-option value="CBSE Board">CBSE Board</mat-option>
                <mat-option value="ICSE Board">ICSE Board</mat-option>
                <mat-option value="State Board">State Board</mat-option>
                <mat-option value="JEE Main">JEE Main</mat-option>
                <mat-option value="JEE Advanced">JEE Advanced</mat-option>
                <mat-option value="NEET UG">NEET UG</mat-option>
                <mat-option value="Olympiad / NTSE">Olympiad / NTSE</mat-option>
                <mat-option value="Foundation">Foundation (9th &amp; 10th)</mat-option>
                <mat-option value="General">General / All Exams</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Exam Year / Range</mat-label>
              <input matInput [(ngModel)]="form.examYear" placeholder="e.g. 2024, 2020-2024" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Difficulty Level</mat-label>
              <mat-select [(ngModel)]="form.difficultyLevel">
                <mat-option value="Easy">Beginner / Easy</mat-option>
                <mat-option value="Medium">Standard / Medium</mat-option>
                <mat-option value="Hard">Advanced / Hard</mat-option>
                <mat-option value="All Levels">All Levels (Comprehensive)</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="w-full">
            <mat-label>Short Summary / Instructions (Optional)</mat-label>
            <textarea matInput [(ngModel)]="form.description" rows="2" placeholder="Brief summary of key topics covered, formula lists or special problem-solving tips..."></textarea>
          </mat-form-field>
        </div>

        <!-- 3. File Upload Section -->
        <div class="form-section-card">
          <div class="section-heading">
            <mat-icon>attachment</mat-icon>
            <span>File Attachment &amp; Resources</span>
          </div>

          <!-- Primary File Upload Area -->
          <div class="upload-dropzone" [class.has-file]="!!form.fileUrl">
            <div class="dropzone-content" *ngIf="!form.fileUrl">
              <div class="dropzone-icon">
                <mat-icon>cloud_upload</mat-icon>
              </div>
              <div class="dropzone-text">
                <strong>Click to upload document file</strong> or drag &amp; drop here
                <span>Supports PDF, DOCX, PPTX, XLSX, ZIP (Up to 50MB)</span>
              </div>
              <input type="file" class="hidden-file-input" (change)="onFileSelected($event, 'file')" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" />
            </div>

            <div class="dropzone-file-preview" *ngIf="form.fileUrl">
              <div class="file-icon-box" [ngClass]="form.fileFormat">
                <mat-icon>description</mat-icon>
              </div>
              <div class="file-details">
                <span class="file-name">{{ form.fileName }}</span>
                <span class="file-meta">
                  <span class="format-pill">{{ form.fileFormat | uppercase }}</span>
                  <span *ngIf="form.fileSizeBytes > 0">{{ formatBytes(form.fileSizeBytes) }}</span>
                  <span class="status-ready">✅ Ready to save</span>
                </span>
              </div>
              <button mat-icon-button color="warn" type="button" (click)="clearFile('file')" matTooltip="Remove file">
                <mat-icon>delete</mat-icon>
              </button>
            </div>

            <mat-progress-bar *ngIf="uploadingFile" mode="indeterminate"></mat-progress-bar>
          </div>

          <!-- Solutions Toggle -->
          <div class="solutions-strip">
            <mat-checkbox [(ngModel)]="form.hasSolutions" color="primary">
              <span class="cb-label">Includes Official Solutions / Answer Key (हल सहित)</span>
            </mat-checkbox>
          </div>

          <!-- Separate Solution File Upload (Optional) -->
          <div class="solution-upload-box" *ngIf="form.hasSolutions">
            <div class="solution-label-row">
              <mat-icon>key</mat-icon>
              <span>Attach Separate Solution / Marking Scheme PDF (Optional):</span>
            </div>
            <div class="sub-dropzone" *ngIf="!form.solutionFileUrl">
              <button mat-stroked-button type="button" class="btn-sub-upload">
                <mat-icon>upload_file</mat-icon> Upload Solution PDF
                <input type="file" class="hidden-file-input" (change)="onFileSelected($event, 'solution')" accept=".pdf,.doc,.docx" />
              </button>
              <span class="sub-hint">If solutions are stored in a separate document</span>
            </div>
            <div class="solution-file-tag" *ngIf="form.solutionFileUrl">
              <mat-icon>check_circle</mat-icon>
              <span>{{ form.solutionFileName }}</span>
              <button mat-icon-button color="warn" type="button" (click)="clearFile('solution')">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <mat-progress-bar *ngIf="uploadingSolution" mode="indeterminate"></mat-progress-bar>
          </div>

          <!-- External Link (Optional) -->
          <mat-form-field appearance="outline" class="w-full" style="margin-top: 14px;">
            <mat-label>Google Drive / Video Lecture Link (Optional)</mat-label>
            <input matInput [(ngModel)]="form.externalLink" placeholder="https://drive.google.com/... or https://youtube.com/..." />
            <mat-icon matPrefix>link</mat-icon>
          </mat-form-field>
        </div>

        <!-- 4. Options -->
        <div class="options-row">
          <mat-checkbox [(ngModel)]="form.isFeatured" color="accent">
            <span class="cb-label">⭐ Mark as Featured (Top of student feed)</span>
          </mat-checkbox>
          <mat-checkbox [(ngModel)]="form.isPublished" color="primary">
            <span class="cb-label">Publish Immediately to Students</span>
          </mat-checkbox>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button type="button" (click)="dialogRef.close()" [disabled]="saving">Cancel</button>
        <button mat-flat-button color="primary" class="submit-btn" [disabled]="!isFormValid() || saving" (click)="save()">
          <mat-icon *ngIf="!saving">check_circle</mat-icon>
          <mat-icon *ngIf="saving" class="spin">refresh</mat-icon>
          <span>{{ saving ? 'Saving...' : (isEdit ? 'Update Material' : 'Upload & Publish') }}</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      width: 100%;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }

    /* Strict UI Rule Header */
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      position: relative;
      flex-shrink: 0;

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
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .header-titles {
        flex: 1 1 auto;
        min-width: 0;
        .main-title {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.78rem;
          color: #3b82f6;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          strong { color: #1e40af; font-weight: 700; }
        }
      }

      .close-btn {
        color: #64748b;
        flex-shrink: 0;
        &:hover { color: #1e293b; background: rgba(0,0,0,0.06); }
      }
    }

    /* Dialog Content Body */
    .dialog-content {
      padding: 20px;
      max-height: calc(85vh - 130px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #f8fafc;
      box-sizing: border-box;

      @media (max-width: 600px) {
        padding: 12px;
        gap: 12px;
      }
    }

    /* Form Section Cards */
    .form-section-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
    }

    .section-heading {
      font-size: 0.85rem;
      font-weight: 700;
      color: #334155;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #2563eb; }
    }

    /* Scope Toggle Row */
    .scope-toggle-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;

      @media (max-width: 680px) {
        grid-template-columns: 1fr;
      }
    }

    .scope-chip-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      cursor: pointer;
      text-align: left;
      transition: all 0.15s ease;
      width: 100%;
      box-sizing: border-box;

      mat-icon { font-size: 24px; width: 24px; height: 24px; color: #64748b; flex-shrink: 0; }

      .chip-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
        strong { font-size: 0.84rem; color: #1e293b; white-space: nowrap; }
        small { font-size: 0.72rem; color: #64748b; margin-top: 1px; }
      }

      &:hover {
        background: #f1f5f9;
        border-color: #94a3b8;
      }

      &.active {
        background: #eff6ff;
        border-color: #2563eb;
        mat-icon { color: #2563eb; }
        .chip-text strong { color: #1e40af; }
        .chip-text small { color: #3b82f6; }
      }
    }

    /* Responsive Grids */
    .grid-2-cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .col-span-2 {
      grid-column: 1 / -1 !important;
      width: 100% !important;
    }

    .grid-3-cols {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .w-full {
      width: 100%;
      display: block;
    }

    .opt-sub { font-size: 0.78rem; color: #64748b; margin-left: 4px; }

    /* Upload Dropzone */
    .upload-dropzone {
      position: relative;
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 20px 16px;
      text-align: center;
      background: #fafafa;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;

      &:hover { border-color: #2563eb; background: #eff6ff; }
      &.has-file { border-style: solid; border-color: #bfdbfe; background: #ffffff; }
    }

    .dropzone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .dropzone-icon {
      width: 48px;
      height: 48px;
      background: #eff6ff;
      color: #2563eb;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 28px; width: 28px; height: 28px; }
    }

    .dropzone-text {
      display: flex;
      flex-direction: column;
      gap: 3px;
      strong { font-size: 0.9rem; color: #1e293b; }
      span { font-size: 0.76rem; color: #64748b; }
    }

    .hidden-file-input {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      opacity: 0;
      cursor: pointer;
      width: 100%; height: 100%;
    }

    .dropzone-file-preview {
      display: flex;
      align-items: center;
      gap: 14px;
      text-align: left;
      padding: 4px;
    }

    .file-icon-box {
      width: 44px;
      height: 44px;
      border-radius: 8px;
      background: #ef4444;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      &.docx, &.doc { background: #2563eb; }
      &.pptx, &.ppt { background: #ea580c; }
      &.xlsx, &.xls { background: #16a34a; }
      &.zip { background: #7c3aed; }
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }

    .file-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }

    .file-name {
      font-size: 0.88rem;
      font-weight: 600;
      color: #0f172a;
      word-break: break-all;
    }

    .file-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.74rem;
      color: #64748b;
      flex-wrap: wrap;
    }

    .format-pill {
      background: #f1f5f9;
      color: #475569;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: 700;
    }

    .status-ready { color: #16a34a; font-weight: 600; }

    /* Solutions Section */
    .solutions-strip {
      margin-top: 12px;
      padding: 4px 0;
    }
    .cb-label { font-size: 0.84rem; font-weight: 600; color: #334155; }

    .solution-upload-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 8px;
    }

    .solution-label-row {
      font-size: 0.8rem;
      font-weight: 600;
      color: #475569;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }

    .btn-sub-upload {
      position: relative;
      font-size: 0.78rem;
    }

    .sub-hint { font-size: 0.75rem; color: #64748b; margin-left: 8px; }

    .solution-file-tag {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #10b981; }
    }

    /* Options */
    .options-row {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 4px 6px;
      flex-wrap: wrap;
    }

    /* Dialog Actions Footer */
    .dialog-actions {
      padding: 12px 20px 16px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-shrink: 0;

      .submit-btn {
        height: 40px;
        font-weight: 700;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(37,99,235,0.25);
      }
    }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class StudyMaterialUploadDialogComponent implements OnInit {
  private readonly studyMaterialService = inject(StudyMaterialService);
  readonly dialogRef = inject(MatDialogRef<StudyMaterialUploadDialogComponent>);

  isEdit = false;
  saving = false;
  uploadingFile = false;
  uploadingSolution = false;

  form: any = {
    title: '',
    description: '',
    targetScope: 'Both',
    classId: null,
    sectionId: null,
    batchId: null,
    subject: '',
    materialType: 'Notes',
    chapterName: '',
    topic: '',
    academicYear: '2026-27',
    targetExam: 'CBSE Board',
    examYear: '2026',
    hasSolutions: false,
    difficultyLevel: 'Medium',
    fileUrl: '',
    fileName: '',
    fileSizeBytes: 0,
    fileFormat: 'pdf',
    externalLink: '',
    solutionFileUrl: '',
    solutionFileName: '',
    isPublished: true,
    isFeatured: false
  };

  constructor(@Inject(MAT_DIALOG_DATA) public data: StudyMaterialDialogData) {}

  ngOnInit() {
    if (this.data.material) {
      this.isEdit = true;
      this.form = { ...this.data.material };
    } else if (this.data.subjects?.length > 0) {
      this.form.subject = this.data.subjects[0].name;
    }
  }

  setScope(scope: 'Both' | 'School' | 'Coaching') {
    this.form.targetScope = scope;
    if (scope === 'School') {
      this.form.batchId = null;
    } else if (scope === 'Coaching') {
      this.form.classId = null;
      this.form.sectionId = null;
    }
  }

  getScopeLabel(scope: string): string {
    if (scope === 'School') return 'School Classes';
    if (scope === 'Coaching') return 'Coaching Batches';
    return 'Open to All (School + Coaching)';
  }

  onClassSelected() {
    this.form.sectionId = null;
  }

  onFileSelected(event: Event, type: 'file' | 'solution') {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (type === 'file') {
      this.uploadingFile = true;
      this.studyMaterialService.uploadFile(file, 'file').subscribe({
        next: res => {
          this.form.fileUrl = res.fileUrl;
          this.form.fileName = res.fileName;
          this.form.fileSizeBytes = res.fileSize;
          this.form.fileFormat = res.fileFormat;
          if (!this.form.title) {
            // Auto fill title from file name without extension
            this.form.title = res.fileName.replace(/\.[^/.]+$/, '').replace(/[_|-]/g, ' ');
          }
          this.uploadingFile = false;
        },
        error: () => this.uploadingFile = false
      });
    } else {
      this.uploadingSolution = true;
      this.studyMaterialService.uploadFile(file, 'solution').subscribe({
        next: res => {
          this.form.solutionFileUrl = res.fileUrl;
          this.form.solutionFileName = res.fileName;
          this.uploadingSolution = false;
        },
        error: () => this.uploadingSolution = false
      });
    }
  }

  clearFile(type: 'file' | 'solution') {
    if (type === 'file') {
      this.form.fileUrl = '';
      this.form.fileName = '';
      this.form.fileSizeBytes = 0;
    } else {
      this.form.solutionFileUrl = '';
      this.form.solutionFileName = '';
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  isFormValid(): boolean {
    return !!this.form.title?.trim() && !!this.form.subject && (!!this.form.fileUrl || !!this.form.externalLink);
  }

  save() {
    if (!this.isFormValid()) return;
    this.saving = true;

    if (this.isEdit) {
      this.studyMaterialService.update(this.data.material!.id, this.form).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: () => this.saving = false
      });
    } else {
      this.studyMaterialService.create(this.form).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close(true);
        },
        error: () => this.saving = false
      });
    }
  }
}
