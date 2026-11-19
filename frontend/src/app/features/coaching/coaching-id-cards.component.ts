import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { HttpClient } from '@angular/common/http';
import { BatchesService, BatchDto } from '../../core/services/batches.service';
import { SchoolService } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

export interface ClassOption {
  id: string;
  name: string;
}

export interface StudentCardItem {
  id: string;
  studentName: string;
  rollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  fatherName?: string;
  mobileNumber?: string;
  parentWhatsAppPhone?: string;
  batchId?: string;
  batchName?: string;
  className?: string;
  profilePhoto?: string;
  photoFailed?: boolean;
  joiningDate?: string;
  address?: string;
}

@Component({
  selector: 'app-coaching-id-cards',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="page-container">
      <!-- Page Header -->
      <div class="page-header no-print">
        <div class="title-area">
          <div class="header-icon-box">
            <mat-icon>badge</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Coaching Student ID Cards (छात्र पहचान पत्र)</h1>
            <p class="page-subtitle">Batch-wise student identification cards with Class ➔ Batch cascade, barcodes, and print-ready templates.</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" class="print-btn" [disabled]="selectedStudentIds.size === 0" (click)="printSelectedCards()">
            <mat-icon>print</mat-icon> Print Selected Cards ({{ selectedStudentIds.size }})
          </button>
        </div>
      </div>

      <!-- Single Prominent Loading Bar -->
      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="global-loader no-print"></mat-progress-bar>
      }

      <!-- Cascading Filter Deck (Class ➔ Batches) -->
      <mat-card class="filter-card mat-elevation-z1 no-print">
        <form [formGroup]="filterForm" class="filter-form">
          <!-- Step 1: Class Selector -->
          <mat-form-field appearance="outline" class="filter-control">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
              <mat-option value="">-- All Classes (सभी कक्षाएं) --</mat-option>
              @for (c of classes; track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Step 2: Cascading Batch Selector -->
          <mat-form-field appearance="outline" class="filter-control highlight-control">
            <mat-label>Coaching Batch (बैच चयन) *</mat-label>
            <mat-select formControlName="batchId" (selectionChange)="onBatchChange($event.value)">
              @if (filteredBatches.length === 0) {
                <mat-option disabled>No batches available for selected class</mat-option>
              }
              @for (b of filteredBatches; track b.id) {
                <mat-option [value]="b.id">
                  <strong>{{ b.name }}</strong> ({{ b.subject || 'All Subjects' }} • {{ b.studentCount || 0 }} Students)
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          <!-- Search Filter -->
          <mat-form-field appearance="outline" class="filter-control search-control">
            <mat-label>Search Student</mat-label>
            <mat-icon matPrefix class="search-icon">search</mat-icon>
            <input matInput formControlName="searchTerm" placeholder="Filter by name, roll, phone..." (input)="applySearchFilter()" />
          </mat-form-field>
        </form>

        <!-- Selection Toolbar -->
        @if (selectedBatchId && students.length > 0) {
          <div class="batch-meta-strip">
            <div class="selection-actions">
              <mat-checkbox [checked]="isAllSelected()" [indeterminate]="isSomeSelected()" (change)="toggleSelectAll($event.checked)">
                Select All ({{ filteredStudents.length }})
              </mat-checkbox>
              <span class="selected-badge">
                <strong>{{ selectedStudentIds.size }}</strong> student card(s) selected
              </span>
            </div>
          </div>
        }
      </mat-card>

      <!-- ID Cards Grid View -->
      @if (selectedBatchId) {
        @if (filteredStudents.length === 0 && !loading) {
          <mat-card class="notice-card mat-elevation-z1 no-print">
            <mat-icon class="notice-icon">person_off</mat-icon>
            <h3>No Students Found in This Batch</h3>
            <p>Allocate students to <strong>{{ selectedBatch?.name }}</strong> to generate ID cards.</p>
          </mat-card>
        } @else {
          <div class="cards-grid">
            @for (s of filteredStudents; track s.id) {
              <div class="id-card-wrapper" [class.selected]="selectedStudentIds.has(s.id)">
                <!-- Checkbox overlay for selection -->
                <div class="card-select-overlay no-print">
                  <mat-checkbox [checked]="selectedStudentIds.has(s.id)" (change)="toggleStudentSelection(s.id, $event.checked)"></mat-checkbox>
                </div>

                <!-- ID Card Front -->
                <div class="id-card">
                  <!-- Header with dynamic institute name -->
                  <div class="card-header">
                    <div class="header-logo-box">
                      @if (instituteLogoUrl) {
                        <img [src]="instituteLogoUrl" alt="Logo" class="header-logo" />
                      } @else {
                        <mat-icon>school</mat-icon>
                      }
                    </div>
                    <div class="header-text-box">
                      <h3 class="inst-name">{{ instituteName }}</h3>
                      <span class="inst-division">COACHING OPERATIONS • BATCH ID</span>
                    </div>
                  </div>

                  <!-- Card Body -->
                  <div class="card-body">
                    <div class="photo-section">
                      <div class="student-photo-box">
                        @if (s.profilePhoto && !s.photoFailed) {
                          <img [src]="getPhotoUrl(s.profilePhoto)" 
                               (error)="s.photoFailed = true" 
                               [alt]="s.studentName" 
                               class="student-img" />
                        } @else {
                          <div class="avatar-portrait" [style.background]="getAvatarGradient(s.studentName)">
                            <span class="avatar-initials">{{ getInitials(s.studentName) }}</span>
                            <span class="avatar-tag">STUDENT</span>
                          </div>
                        }
                      </div>
                      <div class="roll-pill">
                        <span class="roll-lbl">ROLL NO</span>
                        <span class="roll-num">{{ s.coachingRollNumber || s.rollNumber || '—' }}</span>
                      </div>
                    </div>

                    <div class="details-section">
                      <h4 class="student-name">{{ s.studentName }}</h4>
                      <div class="detail-row">
                        <span class="lbl">Batch:</span>
                        <span class="val highlight-val">{{ selectedBatch?.name || s.batchName || 'Coaching' }}</span>
                      </div>
                      @if (s.className) {
                        <div class="detail-row">
                          <span class="lbl">Class:</span>
                          <span class="val">{{ s.className }}</span>
                        </div>
                      }
                      <div class="detail-row">
                        <span class="lbl">Father:</span>
                        <span class="val">{{ s.fatherName || '—' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="lbl">Contact:</span>
                        <span class="val">{{ s.parentWhatsAppPhone || s.mobileNumber || '—' }}</span>
                      </div>
                      <div class="detail-row">
                        <span class="lbl">Adm No:</span>
                        <span class="val">{{ s.admissionNumber || 'N/A' }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Card Footer / Barcode -->
                  <div class="card-footer">
                    <div class="barcode-simulation">
                      <div class="barcode-lines"></div>
                      <span class="barcode-text">*{{ s.admissionNumber || s.id.substring(0, 8) }}*</span>
                    </div>
                    <div class="signature-box">
                      <span class="sign-title">Authorized Signatory</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      } @else {
        <mat-card class="notice-card mat-elevation-z1 no-print">
          <mat-icon class="notice-icon">touch_app</mat-icon>
          <h3>Please Select an Academic Class and Coaching Batch</h3>
          <p>Choose a coaching batch from the filter deck above to view and print student ID cards.</p>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .page-container {
      padding: 0 0 40px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 18px 24px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      mat-icon { font-size: 26px; width: 26px; height: 26px; }
    }

    .page-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.86rem;
      color: #64748b;
      margin: 3px 0 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .print-btn {
      font-weight: 600;
      border-radius: 8px;
      mat-icon { margin-right: 6px; }
    }

    .global-loader {
      border-radius: 4px;
      overflow: hidden;
    }

    .filter-card {
      padding: 18px 22px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .filter-form {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: center;
    }

    .filter-control {
      flex: 1 1 240px;
      min-width: 220px;
    }

    .highlight-control {
      flex: 1 1 300px;
    }

    .search-control {
      flex: 1 1 240px;
    }

    .search-icon {
      color: #64748b;
      margin-right: 6px;
    }

    .batch-meta-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px dashed #e2e8f0;
    }

    .selection-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .selected-badge {
      font-size: 0.84rem;
      color: #475569;
      strong { color: #2563eb; }
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 20px;
    }

    .id-card-wrapper {
      position: relative;
      border-radius: 14px;
      transition: all 0.2s ease;

      &.selected {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }
    }

    .card-select-overlay {
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 10;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 6px;
      padding: 2px 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .id-card {
      width: 100%;
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .card-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 2px solid #bfdbfe;
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-logo-box {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;

      .header-logo {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }

    .header-text-box {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .inst-name {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e3a8a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .inst-division {
      font-size: 0.68rem;
      font-weight: 700;
      color: #3b82f6;
      letter-spacing: 0.05em;
    }

    .card-body {
      padding: 14px;
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }

    .photo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .student-photo-box {
      width: 76px;
      height: 90px;
      border-radius: 8px;
      border: 1.5px solid #cbd5e1;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);

      .student-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .avatar-portrait {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        color: #ffffff;
        user-select: none;
        padding: 4px;
        box-sizing: border-box;

        .avatar-initials {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          line-height: 1;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
        }

        .avatar-tag {
          font-size: 0.52rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: rgba(255, 255, 255, 0.22);
          padding: 1px 5px;
          border-radius: 3px;
        }
      }
    }

    .roll-pill {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 2px 6px;
      text-align: center;
      width: 100%;
      box-sizing: border-box;

      .roll-lbl {
        display: block;
        font-size: 0.62rem;
        font-weight: 700;
        color: #2563eb;
      }

      .roll-num {
        display: block;
        font-size: 0.82rem;
        font-weight: 800;
        color: #1e40af;
      }
    }

    .details-section {
      flex: 1 1 auto;
      min-width: 0;
    }

    .student-name {
      margin: 0 0 8px;
      font-size: 1.05rem;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .detail-row {
      display: flex;
      gap: 6px;
      font-size: 0.78rem;
      margin-bottom: 4px;
      line-height: 1.3;

      .lbl {
        font-weight: 600;
        color: #64748b;
        min-width: 50px;
      }

      .val {
        color: #1e293b;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .highlight-val {
        color: #2563eb;
        font-weight: 700;
      }
    }

    .card-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .barcode-simulation {
      display: flex;
      flex-direction: column;
      align-items: center;

      .barcode-lines {
        width: 90px;
        height: 16px;
        background: repeating-linear-gradient(
          to right,
          #0f172a 0px,
          #0f172a 2px,
          transparent 2px,
          transparent 4px,
          #0f172a 4px,
          #0f172a 5px,
          transparent 5px,
          transparent 7px
        );
      }

      .barcode-text {
        font-size: 0.65rem;
        letter-spacing: 0.1em;
        color: #64748b;
      }
    }

    .signature-box {
      text-align: right;

      .sign-title {
        font-size: 0.66rem;
        font-weight: 600;
        color: #64748b;
        border-top: 1px solid #cbd5e1;
        padding-top: 2px;
        display: inline-block;
      }
    }

    .notice-card {
      padding: 48px 24px;
      text-align: center;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
      background: #f8fafc;
      color: #64748b;
      .notice-icon { font-size: 48px; width: 48px; height: 48px; color: #3b82f6; margin-bottom: 8px; }
      h3 { font-size: 1.15rem; color: #1e3a8a; margin: 0 0 6px; font-weight: 700; }
      p { font-size: 0.88rem; max-width: 500px; margin: 0 auto 16px; line-height: 1.5; }
    }

    /* Print Stylesheet */
    @page {
      size: A4 portrait;
      margin: 8mm 6mm;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .no-print {
        display: none !important;
      }

      :host {
        display: block !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
      }

      .page-container {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        gap: 0 !important;
      }

      .cards-grid {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 12px 10px !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        padding: 2px !important;
        margin: 0 !important;
      }

      .id-card-wrapper {
        min-width: 0 !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        outline: none !important;
        box-shadow: none !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        margin: 0 !important;
        padding: 0 !important;

        &:not(.selected) {
          display: none !important;
        }
      }

      .id-card {
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        border: 1.5px solid #64748b !important;
        border-radius: 10px !important;
        box-shadow: none !important;
        overflow: hidden !important;
      }

      .card-header {
        padding: 8px 10px !important;
      }

      .card-body {
        padding: 10px 10px 6px !important;
        gap: 10px !important;
      }

      .student-photo-box {
        width: 68px !important;
        height: 82px !important;
      }

      .student-name {
        font-size: 0.95rem !important;
        margin: 0 0 4px !important;
      }

      .detail-row {
        font-size: 0.72rem !important;
        margin-bottom: 2px !important;

        .lbl {
          min-width: 44px !important;
        }
      }

      .card-footer {
        padding: 6px 10px !important;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoachingIdCardsComponent implements OnInit {
  filterForm: FormGroup;
  classes: ClassOption[] = [];
  allBatches: BatchDto[] = [];
  filteredBatches: BatchDto[] = [];
  selectedBatch: BatchDto | null = null;
  selectedBatchId: string = '';

  students: StudentCardItem[] = [];
  filteredStudents: StudentCardItem[] = [];
  selectedStudentIds = new Set<string>();

  instituteName: string = '';
  instituteLogoUrl: string | null = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private batchesService: BatchesService,
    private schoolService: SchoolService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.filterForm = this.fb.group({
      classId: [''],
      batchId: [''],
      searchTerm: ['']
    });
  }

  ngOnInit(): void {
    this.instituteName = this.auth.getInstituteName() || this.auth.currentUser()?.instituteName || '';
    this.instituteLogoUrl = this.auth.getInstituteLogoUrl();
    this.loadClasses();
    this.loadBatches();
  }

  loadClasses(): void {
    this.schoolService.getClasses(true, 'Coaching').subscribe({
      next: res => {
        this.classes = (res || []).map(c => ({ id: c.id, name: c.name }));
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  loadBatches(): void {
    this.loading = true;
    this.batchesService.getBatches().subscribe({
      next: batches => {
        this.allBatches = batches || [];
        this.filterBatchesByClass();
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  onClassChange(classId: string): void {
    this.filterBatchesByClass();
    this.filterForm.patchValue({ batchId: '' });
    this.selectedBatchId = '';
    this.selectedBatch = null;
    this.students = [];
    this.filteredStudents = [];
    this.selectedStudentIds.clear();
    this.cdr.markForCheck();
  }

  filterBatchesByClass(): void {
    const selectedClassId = this.filterForm.get('classId')?.value;
    if (!selectedClassId) {
      this.filteredBatches = [...this.allBatches];
    } else {
      this.filteredBatches = this.allBatches.filter(b => b.classId === selectedClassId || !b.classId);
    }
  }

  onBatchChange(batchId: string): void {
    this.selectedBatchId = batchId;
    this.selectedBatch = this.allBatches.find(b => b.id === batchId) || null;
    this.selectedStudentIds.clear();
    if (batchId) {
      this.loadStudents(batchId);
    } else {
      this.students = [];
      this.filteredStudents = [];
    }
    this.cdr.markForCheck();
  }

  loadStudents(batchId: string): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/students/paged?batchId=${batchId}&pageSize=500`).subscribe({
      next: res => {
        this.students = (res.items || []).map((s: any) => ({
          id: s.id,
          studentName: s.studentName,
          rollNumber: s.rollNumber,
          coachingRollNumber: s.coachingRollNumber,
          admissionNumber: s.admissionNumber,
          fatherName: s.fatherName || s.parentName,
          mobileNumber: s.mobileNumber || s.parentWhatsAppPhone,
          parentWhatsAppPhone: s.parentWhatsAppPhone,
          batchId: s.batchId,
          batchName: s.batchName,
          className: s.className,
          profilePhoto: s.profilePhoto || s.photoUrl || s.photo || s.avatarUrl,
          photoFailed: false,
          joiningDate: s.joiningDate,
          address: s.address
        }));
        this.applySearchFilter();
        // By default select all for convenient bulk printing
        this.students.forEach(s => this.selectedStudentIds.add(s.id));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  applySearchFilter(): void {
    const term = (this.filterForm.get('searchTerm')?.value || '').trim().toLowerCase();
    if (!term) {
      this.filteredStudents = [...this.students];
    } else {
      this.filteredStudents = this.students.filter(s =>
        (s.studentName || '').toLowerCase().includes(term) ||
        (s.rollNumber || '').toLowerCase().includes(term) ||
        (s.coachingRollNumber || '').toLowerCase().includes(term) ||
        (s.admissionNumber || '').toLowerCase().includes(term) ||
        (s.fatherName || '').toLowerCase().includes(term) ||
        (s.parentWhatsAppPhone || '').toLowerCase().includes(term)
      );
    }
    this.cdr.markForCheck();
  }

  toggleStudentSelection(studentId: string, checked: boolean): void {
    if (checked) {
      this.selectedStudentIds.add(studentId);
    } else {
      this.selectedStudentIds.delete(studentId);
    }
    this.cdr.markForCheck();
  }

  isAllSelected(): boolean {
    return this.filteredStudents.length > 0 && this.filteredStudents.every(s => this.selectedStudentIds.has(s.id));
  }

  isSomeSelected(): boolean {
    return this.selectedStudentIds.size > 0 && !this.isAllSelected();
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.filteredStudents.forEach(s => this.selectedStudentIds.add(s.id));
    } else {
      this.selectedStudentIds.clear();
    }
    this.cdr.markForCheck();
  }

  getPhotoUrl(photo?: string | null): string {
    if (!photo) return '';
    return this.auth.resolveLogoUrl(photo) || '';
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  getAvatarGradient(name: string): string {
    if (!name) return 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)';
    const gradients = [
      'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      'linear-gradient(135deg, #059669 0%, #047857 100%)',
      'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
      'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
      'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
      'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
      'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  }

  printSelectedCards(): void {
    window.print();
  }
}
