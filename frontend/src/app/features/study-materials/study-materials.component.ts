import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { StudyMaterialService } from './study-material.service';
import { StudyMaterialDto, StudyMaterialStatsDto } from './study-material.models';
import { StudyMaterialUploadDialogComponent } from './study-material-upload-dialog.component';
import { StudyMaterialViewerDialogComponent } from './study-material-viewer-dialog.component';
import { CoachingService } from '../../core/services/coaching.service';

@Component({
  selector: 'app-study-materials',
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
    MatTooltipModule,
    MatDialogModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  template: `
<div class="page-container">
  <!-- Page Header -->
  <div class="page-header">
    <div class="page-header-text">
      <div class="badge-title-row">
        <span class="module-badge"><mat-icon>auto_stories</mat-icon> Academic Repository</span>
        <span class="active-scope-badge" [ngClass]="currentScope.toLowerCase()">
          {{ currentScope === 'School' ? '🏫 School Classes' : currentScope === 'Coaching' ? '🎯 Coaching Batches' : '🌐 School + Coaching Repository' }}
        </span>
        <span class="student-profile-badge" *ngIf="isStudent() && loggedInStudent">
          <mat-icon>verified_user</mat-icon>
          <span>Enrolled: <strong>{{ loggedInStudent.className || 'Class 3rd' }}</strong></span>
          <span *ngIf="loggedInStudent.batchName">&nbsp;• <strong>{{ loggedInStudent.batchName }}</strong></span>
        </span>
      </div>
      <h1 class="page-title">Study Material &amp; Question Bank Repository (डिजिटल नोट्स और PYQ)</h1>
      <p class="page-subtitle">
        Centralized chapter-wise concept notes, previous year board &amp; entrance examination questions, question banks &amp; formula sheets.
      </p>
    </div>

    <div class="header-actions">
      <!-- 1-Click Upload Button (for Staff/Teachers/Admin) -->
      <button mat-flat-button color="primary" class="upload-btn" (click)="openUploadDialog()" *ngIf="canUpload()">
        <mat-icon>cloud_upload</mat-icon> Upload Study Material / PYQ
      </button>
    </div>
  </div>

  <!-- Top Metrics Bar -->
  <div class="stats-grid" *ngIf="stats">
    <div class="stat-card">
      <div class="stat-icon-wrap total"><mat-icon>library_books</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ stats.totalItems }}</span>
        <span class="stat-label">Total Documents</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap notes"><mat-icon>menu_book</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ stats.notesCount }}</span>
        <span class="stat-label">Digital Notes (नोट्स)</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap pyq"><mat-icon>history_edu</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ stats.pyqCount }}</span>
        <span class="stat-label">PYQ Papers (पिछले वर्ष के प्रश्न)</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap qb"><mat-icon>quiz</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ stats.questionBankCount + stats.formulaSheetCount }}</span>
        <span class="stat-label">Question Bank &amp; Formulas</span>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon-wrap dl"><mat-icon>download</mat-icon></div>
      <div class="stat-info">
        <span class="stat-val">{{ stats.totalDownloads }}</span>
        <span class="stat-label">Student Downloads</span>
      </div>
    </div>
  </div>

  <!-- Main Filter & Control Center -->
  <mat-card class="filter-card">
    <!-- Row 1: Scope Switcher (All Optional & Responsive) -->
    <div class="scope-bar">
      <div class="scope-pills">
        <button 
          type="button" 
          class="scope-pill" 
          [class.active]="currentScope === 'All'"
          (click)="setScope('All')">
          <mat-icon>public</mat-icon>
          <span>All Materials</span>
        </button>
        <button 
          type="button" 
          class="scope-pill" 
          [class.active]="currentScope === 'School'"
          (click)="setScope('School')"
          *ngIf="hasSchoolAccess() && (!isStudent() || loggedInStudent?.isSchoolStudent)">
          <mat-icon>school</mat-icon>
          <span>🏫 School Classes</span>
        </button>
        <button 
          type="button" 
          class="scope-pill" 
          [class.active]="currentScope === 'Coaching'"
          (click)="setScope('Coaching')"
          *ngIf="hasCoachingAccess() && (!isStudent() || loggedInStudent?.isCoachingStudent)">
          <mat-icon>psychology</mat-icon>
          <span>🎯 Coaching Batches</span>
        </button>
      </div>

      <!-- Quick Search Input -->
      <div class="search-box">
        <mat-icon>search</mat-icon>
        <input 
          type="text" 
          [(ngModel)]="searchKeyword" 
          (ngModelChange)="onSearchChanged()" 
          placeholder="Search by title, chapter, topic, or exam (e.g. Physics, Light, JEE 2024)..." />
        <button *ngIf="searchKeyword" mat-icon-button (click)="searchKeyword = ''; onSearchChanged()" class="clear-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    </div>

    <!-- Row 2: Material Type Tabs -->
    <div class="type-tabs-row">
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'All'" 
        (click)="setType('All')">
        All Types
      </button>
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'Notes'" 
        (click)="setType('Notes')">
        📝 Concept Notes (नोट्स)
      </button>
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'PYQ'" 
        (click)="setType('PYQ')">
        🎯 PYQs (पिछले वर्ष के प्रश्न)
      </button>
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'QuestionBank'" 
        (click)="setType('QuestionBank')">
        📚 Question Bank &amp; DPP
      </button>
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'FormulaSheet'" 
        (click)="setType('FormulaSheet')">
        ⚡ Formula Sheets &amp; Mindmaps
      </button>
      <button 
        type="button" 
        class="type-tab" 
        [class.active]="activeType === 'SamplePaper'" 
        (click)="setType('SamplePaper')">
        📄 Sample &amp; Model Papers
      </button>
    </div>

    <!-- Row 3: Optional Granular Filters (Class / Batch / Subject / Exam) -->
    <div class="dropdowns-row">
      <!-- School Class filter -->
      <mat-form-field appearance="outline" class="filter-field" *ngIf="shouldShowClassFilter()">
        <mat-label>School Class</mat-label>
        <mat-select [(ngModel)]="selectedClassId" (selectionChange)="loadMaterials()">
          <mat-option [value]="null" *ngIf="!isStudent()">All Classes</mat-option>
          <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Coaching Batch filter -->
      <mat-form-field appearance="outline" class="filter-field" *ngIf="shouldShowBatchFilter()">
        <mat-label>Coaching Batch</mat-label>
        <mat-select [(ngModel)]="selectedBatchId" (selectionChange)="loadMaterials()">
          <mat-option [value]="null" *ngIf="!isStudent()">All Batches</mat-option>
          <mat-option *ngFor="let b of batches" [value]="b.id">{{ b.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Subject filter -->
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Subject</mat-label>
        <mat-select [(ngModel)]="selectedSubject" (selectionChange)="loadMaterials()">
          <mat-option value="All">All Subjects</mat-option>
          <mat-option *ngFor="let s of subjects" [value]="s.name">{{ s.name }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Target Exam filter -->
      <mat-form-field appearance="outline" class="filter-field">
        <mat-label>Target Exam</mat-label>
        <mat-select [(ngModel)]="selectedTargetExam" (selectionChange)="loadMaterials()">
          <mat-option value="All">All Exams</mat-option>
          <mat-option value="CBSE Board">CBSE Board</mat-option>
          <mat-option value="ICSE Board">ICSE Board</mat-option>
          <mat-option value="State Board">State Board</mat-option>
          <mat-option value="JEE Main">JEE Main</mat-option>
          <mat-option value="JEE Advanced">JEE Advanced</mat-option>
          <mat-option value="NEET UG">NEET UG</mat-option>
          <mat-option value="Foundation">Foundation</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Solutions filter toggle -->
      <button 
        type="button" 
        class="filter-toggle-btn" 
        [class.active]="filterWithSolutions" 
        (click)="toggleSolutionsFilter()">
        <mat-icon>{{ filterWithSolutions ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
        <span>With Solutions (हल सहित)</span>
      </button>

      <!-- Reset Filter Button -->
      <button 
        mat-button 
        type="button" 
        class="reset-btn" 
        *ngIf="isFilterActive" 
        (click)="resetFilters()">
        <mat-icon>filter_alt_off</mat-icon> Clear Filters
      </button>
    </div>
  </mat-card>

  <!-- Loading State -->
  <mat-progress-bar *ngIf="loading" mode="indeterminate" class="load-bar"></mat-progress-bar>

  <!-- Empty State -->
  <div class="empty-state" *ngIf="!loading && materials.length === 0">
    <div class="empty-icon-wrap">
      <mat-icon>auto_stories</mat-icon>
    </div>
    <h3>No Study Material Found</h3>
    <p>There are no notes, PYQs or question banks matching your selected criteria.</p>
    <button mat-stroked-button color="primary" (click)="resetFilters()" *ngIf="isFilterActive">
      Reset All Filters
    </button>
  </div>

  <!-- Cards Grid Layout -->
  <div class="materials-grid" *ngIf="!loading && materials.length > 0">
    <mat-card class="material-card" *ngFor="let item of materials" [class.featured]="item.isFeatured">
      <!-- Card Header Strip -->
      <div class="card-top-strip">
        <div class="type-pill" [ngClass]="item.materialType.toLowerCase()">
          {{ getTypeLabel(item.materialType) }}
        </div>
        <div class="format-pill" [ngClass]="item.fileFormat">
          {{ item.fileFormat | uppercase }}
        </div>
      </div>

      <!-- Card Main Content -->
      <div class="card-body">
        <div class="subject-line">
          <span class="subject-tag">{{ item.subject }}</span>
          <span class="scope-tag" [ngClass]="item.targetScope.toLowerCase()">
            {{ item.targetScope === 'School' ? '🏫 School' : item.targetScope === 'Coaching' ? '🎯 Coaching' : '🌐 Open' }}
          </span>
          <span class="featured-star" *ngIf="item.isFeatured" matTooltip="Featured Material">⭐</span>
        </div>

        <h3 class="material-title" [title]="item.title" (click)="previewMaterial(item)">
          {{ item.title }}
        </h3>

        <div class="chapter-line" *ngIf="item.chapterName || item.topic">
          <mat-icon>bookmark_border</mat-icon>
          <span>{{ item.chapterName || item.topic }}</span>
        </div>

        <p class="material-desc" *ngIf="item.description">
          {{ item.description }}
        </p>

        <!-- Exam & Target Info Chips -->
        <div class="meta-chips-wrap">
          <span class="meta-chip exam-chip" *ngIf="item.targetExam">
            <mat-icon>school</mat-icon> {{ item.targetExam }}
          </span>
          <span class="meta-chip year-chip" *ngIf="item.examYear">
            <mat-icon>event</mat-icon> {{ item.examYear }}
          </span>
          <span class="meta-chip sol-chip" *ngIf="item.hasSolutions">
            <mat-icon>check_circle</mat-icon> Solved
          </span>
          <span class="meta-chip size-chip" *ngIf="item.fileSizeBytes > 0">
            <mat-icon>storage</mat-icon> {{ formatBytes(item.fileSizeBytes) }}
          </span>
        </div>
      </div>

      <!-- Card Footer with Stats & Actions -->
      <div class="card-footer">
        <div class="stats-counters">
          <span matTooltip="Downloads count"><mat-icon>download</mat-icon> {{ item.downloadCount }}</span>
          <span matTooltip="Views count"><mat-icon>visibility</mat-icon> {{ item.viewCount }}</span>
        </div>

        <div class="action-buttons">
          <!-- Preview in App -->
          <button mat-stroked-button color="primary" class="preview-btn" (click)="previewMaterial(item)">
            <mat-icon>visibility</mat-icon> Preview
          </button>

          <!-- Direct Download -->
          <button type="button" class="dl-btn" (click)="downloadMaterial(item)" matTooltip="Download file">
            <mat-icon>download</mat-icon>
          </button>

          <!-- WhatsApp Share -->
          <button mat-icon-button class="wa-btn" (click)="shareViaWhatsApp(item)" matTooltip="Share via WhatsApp">
            <mat-icon>share</mat-icon>
          </button>

          <!-- Delete / Edit for faculty -->
          <button mat-icon-button class="del-btn" *ngIf="canUpload()" (click)="deleteMaterial(item)" matTooltip="Delete material">
            <mat-icon>delete_outline</mat-icon>
          </button>
        </div>
      </div>
    </mat-card>
  </div>
</div>
  `,
  styles: [`
    .page-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
      box-sizing: border-box;
    }

    /* Page Header */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .badge-title-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .module-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #eff6ff;
      color: #2563eb;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .active-scope-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      background: #f1f5f9;
      color: #475569;
      &.school { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
      &.coaching { background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; }
      &.all { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    }
    .student-profile-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      strong { color: #1e3a8a; font-weight: 700; }
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
    }
    .page-title {
      font-size: 1.45rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
      letter-spacing: -0.02em;
    }
    .page-subtitle {
      font-size: 0.88rem;
      color: #64748b;
      margin: 4px 0 0 0;
    }
    .upload-btn {
      font-weight: 700;
      padding: 8px 18px;
      border-radius: 10px;
      box-shadow: 0 4px 10px rgba(37,99,235,0.25);
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
    }
    .stat-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover { transform: translateY(-2px); box-shadow: 0 6px 14px rgba(0,0,0,0.05); }
    }
    .stat-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
      &.total { background: #eff6ff; color: #2563eb; }
      &.notes { background: #f0fdf4; color: #16a34a; }
      &.pyq { background: #faf5ff; color: #9333ea; }
      &.qb { background: #fff7ed; color: #ea580c; }
      &.dl { background: #fdf2f8; color: #db2777; }
    }
    .stat-info {
      display: flex;
      flex-direction: column;
    }
    .stat-val {
      font-size: 1.35rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.1;
    }
    .stat-label {
      font-size: 0.76rem;
      font-weight: 600;
      color: #64748b;
      margin-top: 2px;
    }

    /* Filter Card */
    .filter-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }
    .scope-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .scope-pills {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scope-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 20px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover { background: #e2e8f0; }
      &.active {
        background: #2563eb;
        border-color: #2563eb;
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(37,99,235,0.3);
      }
    }

    /* Search Box */
    .search-box {
      flex: 1;
      max-width: 450px;
      position: relative;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 24px;
      padding: 0 12px;
      transition: border-color 0.15s;
      mat-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; margin-right: 6px; }
      input {
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.85rem;
        color: #1e293b;
        width: 100%;
        padding: 8px 0;
      }
      &:focus-within {
        border-color: #2563eb;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
      }
      .clear-btn { width: 24px; height: 24px; mat-icon { font-size: 16px; } }
    }

    /* Type Tabs */
    .type-tabs-row {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .type-tab {
      padding: 6px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;
      &:hover { background: #f1f5f9; color: #1e293b; }
      &.active {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #2563eb;
        font-weight: 700;
      }
    }

    /* Dropdowns row */
    .dropdowns-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .filter-field {
      flex: 1;
      min-width: 160px;
      max-width: 220px;
    }
    .filter-toggle-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: all 0.15s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
      &.active {
        background: #ecfdf5;
        border-color: #10b981;
        color: #065f46;
        mat-icon { color: #10b981; }
      }
    }
    .reset-btn {
      color: #dc2626;
      font-size: 0.8rem;
      font-weight: 600;
      mat-icon { font-size: 18px; margin-right: 4px; }
    }

    /* Materials Grid */
    .materials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 18px;
    }
    .material-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      &:hover { transform: translateY(-3px); box-shadow: 0 10px 20px -5px rgba(0,0,0,0.08); }
      &.featured { border-color: #fde047; box-shadow: 0 4px 12px rgba(234,179,8,0.15); }
    }

    .card-top-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 0 16px;
    }
    .type-pill {
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #eff6ff;
      color: #2563eb;
      &.pyq { background: #faf5ff; color: #7c3aed; }
      &.questionbank { background: #fff7ed; color: #ea580c; }
      &.formulasheet { background: #ecfdf5; color: #059669; }
      &.samplepaper { background: #fdf2f8; color: #db2777; }
    }
    .format-pill {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      background: #ef4444;
      color: #fff;
      &.docx, &.doc { background: #2563eb; }
      &.pptx, &.ppt { background: #ea580c; }
      &.zip { background: #7c3aed; }
    }

    .card-body {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    .subject-line {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .subject-tag {
      font-size: 0.78rem;
      font-weight: 700;
      color: #2563eb;
    }
    .scope-tag {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      &.school { background: #fef3c7; color: #92400e; }
      &.coaching { background: #ede9fe; color: #5b21b6; }
    }
    .featured-star { font-size: 0.85rem; }

    .material-title {
      font-size: 0.98rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.35;
      cursor: pointer;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      &:hover { color: #2563eb; }
    }
    .chapter-line {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.8rem;
      color: #64748b;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
      span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .material-desc {
      font-size: 0.8rem;
      color: #64748b;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .meta-chips-wrap {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }
    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #475569;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.exam-chip { background: #eff6ff; color: #1e40af; }
      &.year-chip { background: #faf5ff; color: #6b21a8; }
      &.sol-chip { background: #ecfdf5; color: #065f46; mat-icon { color: #10b981; } }
    }

    .card-footer {
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .stats-counters {
      display: flex;
      align-items: center;
      gap: 12px;
      span {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 0.74rem;
        font-weight: 600;
        color: #64748b;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }
      }
    }
    .action-buttons {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .preview-btn {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0 10px;
      height: 32px;
      line-height: 32px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    }
    .dl-btn {
      width: 32px;
      height: 32px;
      min-width: 32px;
      max-width: 32px;
      padding: 0;
      margin: 0;
      border: none;
      outline: none;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
      transition: all 0.15s ease;
      box-sizing: border-box;

      &:hover {
        background: #1d4ed8;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45);
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        margin: 0;
        padding: 0;
      }
    }
    .wa-btn {
      color: #25d366;
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      }
    }
    .del-btn {
      color: #94a3b8;
      width: 32px;
      height: 32px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0;
      }
      &:hover { color: #ef4444; }
    }

    /* Empty State */
    .empty-state {
      background: #ffffff;
      border: 1px dashed #cbd5e1;
      border-radius: 16px;
      padding: 48px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      h3 { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0; }
      p { font-size: 0.88rem; color: #64748b; margin: 0; max-width: 400px; }
    }
    .empty-icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; }
    }

    @media (max-width: 992px) {
      .stats-grid { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 768px) {
      .page-header { flex-direction: column; align-items: stretch; gap: 12px; }
      .header-actions { width: 100%; }
      .upload-btn { width: 100%; justify-content: center; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
      .scope-bar { flex-direction: column; align-items: stretch; gap: 10px; }
      .scope-pills { overflow-x: auto; width: 100%; padding-bottom: 4px; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
      .search-box { max-width: 100%; width: 100%; }
      .type-tabs-row { overflow-x: auto; width: 100%; padding-bottom: 4px; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
      .dropdowns-row { flex-direction: column; align-items: stretch; }
      .filter-field { max-width: 100%; width: 100%; }
      .filter-toggle-btn { width: 100%; justify-content: center; }
      .materials-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 480px) {
      .stats-grid { grid-template-columns: 1fr; }
      .page-title { font-size: 1.22rem; }
      .card-footer { flex-direction: column; align-items: stretch; gap: 8px; }
      .action-buttons { justify-content: flex-end; width: 100%; }
    }
  `]
})
export class StudyMaterialsComponent implements OnInit {
  private readonly studyMaterialService = inject(StudyMaterialService);
  private readonly authService = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly dialog = inject(MatDialog);
  private readonly http = inject(HttpClient);
  private readonly coachingService = inject(CoachingService);

  currentUser = this.authService.currentUser;
  loggedInStudent: any = null;

  materials: StudyMaterialDto[] = [];
  stats: StudyMaterialStatsDto | null = null;
  loading = false;

  // Dropdown reference lists
  classes: any[] = [];
  batches: any[] = [];
  subjects: any[] = [];

  // Active filters (all optional)
  currentScope: 'All' | 'School' | 'Coaching' = 'All';
  activeType: string = 'All';
  selectedClassId: string | null = null;
  selectedBatchId: string | null = null;
  selectedSubject: string = 'All';
  selectedTargetExam: string = 'All';
  searchKeyword: string = '';
  filterWithSolutions = false;

  private searchDebounceTimer: any;

  ngOnInit() {
    this.initScopeDefaults();
    this.loadMetadata();
    this.loadStats();

    if (this.isStudent()) {
      this.initStudentProfile();
    } else {
      this.loadMaterials();
    }
  }

  isStudent(): boolean {
    const role = (this.currentUser()?.role || '').toLowerCase();
    return role === 'student' || role === 'parent';
  }

  initStudentProfile() {
    this.coachingService.getMyStudentProfile360().subscribe({
      next: (profile) => {
        const student = profile?.student;
        if (student) {
          this.loggedInStudent = student;

          // Auto-adjust scope
          if (student.isSchoolStudent && !student.isCoachingStudent) {
            this.currentScope = 'School';
          } else if (student.isCoachingStudent && !student.isSchoolStudent) {
            this.currentScope = 'Coaching';
          } else {
            this.currentScope = 'All';
          }

          // Pre-populate School Class
          if (student.isSchoolStudent && student.classId) {
            const classMatch = this.classes.find(c => c.id.toLowerCase() === student.classId?.toLowerCase());
            this.selectedClassId = classMatch ? classMatch.id : student.classId;
          }

          // Pre-populate Coaching Batch
          if (student.isCoachingStudent && student.batchId) {
            const batchMatch = this.batches.find(b => b.id.toLowerCase() === student.batchId?.toLowerCase());
            this.selectedBatchId = batchMatch ? batchMatch.id : student.batchId;
          }

          this.loadStats();
          this.loadMaterials();
        } else {
          this.loadMaterials();
        }
      },
      error: () => {
        this.loadMaterials();
      }
    });
  }

  shouldShowClassFilter(): boolean {
    if (this.isStudent()) {
      return this.loggedInStudent ? !!this.loggedInStudent.isSchoolStudent : true;
    }
    return this.currentScope !== 'Coaching' && this.classes.length > 0;
  }

  shouldShowBatchFilter(): boolean {
    if (this.isStudent()) {
      return this.loggedInStudent ? !!this.loggedInStudent.isCoachingStudent : true;
    }
    return this.currentScope !== 'School' && this.batches.length > 0;
  }

  initScopeDefaults() {
    const user = this.currentUser();
    if (user?.hasSchoolModule && !user?.hasCoachingModule) {
      this.currentScope = 'School';
    } else if (user?.hasCoachingModule && !user?.hasSchoolModule) {
      this.currentScope = 'Coaching';
    } else {
      this.currentScope = 'All';
    }
  }

  loadMetadata() {
    // 1. Classes
    this.http.get<any[]>('http://localhost:5000/api/school/classes?activeOnly=true').subscribe({
      next: res => {
        this.classes = res || [];
        if (this.loggedInStudent?.isSchoolStudent && this.loggedInStudent?.classId) {
          const classMatch = this.classes.find(c => c.id.toLowerCase() === this.loggedInStudent.classId?.toLowerCase());
          if (classMatch) {
            this.selectedClassId = classMatch.id;
          }
        }
      },
      error: () => {}
    });

    // 2. Batches
    this.http.get<any[]>('http://localhost:5000/api/batches?activeOnly=true').subscribe({
      next: res => {
        this.batches = res || [];
        if (this.loggedInStudent?.isCoachingStudent && this.loggedInStudent?.batchId) {
          const batchMatch = this.batches.find(b => b.id.toLowerCase() === this.loggedInStudent.batchId?.toLowerCase());
          if (batchMatch) {
            this.selectedBatchId = batchMatch.id;
          }
        }
      },
      error: () => {}
    });

    // 3. Subjects
    this.http.get<any[]>('http://localhost:5000/api/Subjects?activeOnly=true').subscribe({
      next: res => this.subjects = res || [],
      error: () => {}
    });
  }

  loadStats() {
    this.studyMaterialService.getStats(this.currentScope).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadMaterials() {
    this.loading = true;
    this.studyMaterialService.getMaterials({
      scope: this.currentScope,
      classId: this.selectedClassId || undefined,
      batchId: this.selectedBatchId || undefined,
      subject: this.selectedSubject !== 'All' ? this.selectedSubject : undefined,
      materialType: this.activeType !== 'All' ? this.activeType : undefined,
      targetExam: this.selectedTargetExam !== 'All' ? this.selectedTargetExam : undefined,
      search: this.searchKeyword?.trim() || undefined,
      hasSolutions: this.filterWithSolutions ? true : undefined,
      page: 1,
      pageSize: 50
    }).subscribe({
      next: res => {
        this.materials = res.items || [];
        this.loading = false;
      },
      error: () => {
        this.materials = [];
        this.loading = false;
      }
    });
  }

  setScope(scope: 'All' | 'School' | 'Coaching') {
    this.currentScope = scope;
    if (scope === 'School') this.selectedBatchId = null;
    if (scope === 'Coaching') this.selectedClassId = null;
    this.loadStats();
    this.loadMaterials();
  }

  setType(type: string) {
    this.activeType = type;
    this.loadMaterials();
  }

  toggleSolutionsFilter() {
    this.filterWithSolutions = !this.filterWithSolutions;
    this.loadMaterials();
  }

  onSearchChanged() {
    clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.loadMaterials();
    }, 250);
  }

  get isFilterActive(): boolean {
    return this.currentScope !== 'All' ||
      this.activeType !== 'All' ||
      !!this.selectedClassId ||
      !!this.selectedBatchId ||
      this.selectedSubject !== 'All' ||
      this.selectedTargetExam !== 'All' ||
      !!this.searchKeyword.trim() ||
      this.filterWithSolutions;
  }

  resetFilters() {
    this.activeType = 'All';
    this.selectedSubject = 'All';
    this.selectedTargetExam = 'All';
    this.searchKeyword = '';
    this.filterWithSolutions = false;

    if (this.isStudent() && this.loggedInStudent) {
      if (this.loggedInStudent.isSchoolStudent && this.loggedInStudent.classId) {
        const classMatch = this.classes.find(c => c.id.toLowerCase() === this.loggedInStudent.classId?.toLowerCase());
        this.selectedClassId = classMatch ? classMatch.id : this.loggedInStudent.classId;
      }
      if (this.loggedInStudent.isCoachingStudent && this.loggedInStudent.batchId) {
        const batchMatch = this.batches.find(b => b.id.toLowerCase() === this.loggedInStudent.batchId?.toLowerCase());
        this.selectedBatchId = batchMatch ? batchMatch.id : this.loggedInStudent.batchId;
      }
      this.currentScope = this.loggedInStudent.isSchoolStudent && !this.loggedInStudent.isCoachingStudent ? 'School' :
                          this.loggedInStudent.isCoachingStudent && !this.loggedInStudent.isSchoolStudent ? 'Coaching' : 'All';
    } else {
      this.currentScope = 'All';
      this.selectedClassId = null;
      this.selectedBatchId = null;
    }

    this.loadStats();
    this.loadMaterials();
  }

  previewMaterial(item: StudyMaterialDto) {
    this.dialog.open(StudyMaterialViewerDialogComponent, {
      data: { material: item },
      width: '95vw',
      maxWidth: '1400px',
      panelClass: 'study-material-dialog-panel'
    });
  }

  downloadMaterial(item: StudyMaterialDto) {
    const url = item.fileUrl.startsWith('http') ? item.fileUrl : `http://localhost:5000${item.fileUrl}`;
    this.studyMaterialService.trackDownload(item.id).subscribe({
      next: res => {
        item.downloadCount = res.downloadCount;
      }
    });

    const link = document.createElement('a');
    link.href = url;
    link.download = item.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  shareViaWhatsApp(item: StudyMaterialDto) {
    const fileFullUrl = item.fileUrl.startsWith('http') ? item.fileUrl : `http://localhost:5000${item.fileUrl}`;
    const text = `📚 *Study Material Shared*: ${item.title}\n📖 *Subject*: ${item.subject} (${item.materialType})\n🔗 *Download Link*: ${fileFullUrl}\n\nShared via Apex Academy IMSERP.`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  openUploadDialog() {
    const dialogRef = this.dialog.open(StudyMaterialUploadDialogComponent, {
      data: {
        classes: this.classes,
        batches: this.batches,
        subjects: this.subjects
      },
      width: '760px',
      maxWidth: '96vw',
      panelClass: 'study-material-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(saved => {
      if (saved) {
        this.loadStats();
        this.loadMaterials();
      }
    });
  }

  deleteMaterial(item: StudyMaterialDto) {
    this.confirmDialog.danger(
      'Delete Study Material',
      `Are you sure you want to permanently delete "${item.title}"?`,
      'Delete'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.studyMaterialService.delete(item.id).subscribe({
          next: () => {
            this.loadStats();
            this.loadMaterials();
          }
        });
      }
    });
  }

  canUpload(): boolean {
    const role = this.currentUser()?.role;
    return role === 'SuperAdmin' || role === 'InstituteAdmin' || role === 'Admin' || role === 'Teacher' || role === 'Faculty';
  }

  hasSchoolAccess(): boolean {
    const user = this.currentUser();
    return user?.hasSchoolModule !== false;
  }

  hasCoachingAccess(): boolean {
    const user = this.currentUser();
    return user?.hasCoachingModule !== false;
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'Notes': return '📝 Concept Notes';
      case 'PYQ': return '🎯 Board / Entrance PYQ';
      case 'QuestionBank': return '📚 Question Bank & DPP';
      case 'FormulaSheet': return '⚡ Formula Sheet';
      case 'SamplePaper': return '📄 Model Paper';
      case 'Syllabus': return '📌 Blueprint';
      default: return type;
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}
