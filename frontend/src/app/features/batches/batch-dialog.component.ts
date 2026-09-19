import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BatchDto, BatchesService } from '../../core/services/batches.service';
import { SubjectDto, SubjectsService } from '../../core/services/subjects.service';
import { BranchDto, BranchService } from '../../core/services/branch.service';
import { RoomDto, RoomService } from '../../core/services/room.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-batch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="header-icon-wrap">
          <mat-icon>{{ isEditMode ? 'edit_note' : 'add_circle' }}</mat-icon>
        </div>
        <div class="header-titles">
          <h2 mat-dialog-title class="main-title">{{ isEditMode ? 'Edit Academic Batch' : 'Create New Academic Batch' }}</h2>
          <p class="subtitle">{{ isEditMode ? 'Modify batch curriculum, campus, room allocation and fee rate.' : 'Configure a new coaching batch with campus, room assignment and monthly fee.' }}</p>
        </div>
        <button mat-icon-button type="button" class="close-btn" (click)="onCancel()" [disabled]="saving">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading" class="dialog-loader"></mat-progress-bar>

      <form [formGroup]="batchForm" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">

          <!-- Info Callout -->
          <div class="info-callout">
            <mat-icon class="info-icon">auto_awesome</mat-icon>
            <div class="info-text">
              <strong>Academic Batch Setup:</strong> Link subjects, allocate classroom capacity, and define standard monthly tuition fees for automated student billing.
            </div>
          </div>

          <!-- Section: Batch Info & Subjects -->
          <div class="section-label">
            <mat-icon class="section-icon">school</mat-icon>
            <span>Batch &amp; Subject Details</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Batch Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Class 10th (Batch - 1) - Chemistry" />
              <mat-icon matSuffix color="primary">school</mat-icon>
              <mat-error *ngIf="batchForm.get('name')?.hasError('required')">Batch name is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Subjects Covered (Select Chips) *</mat-label>
              <mat-select formControlName="selectedSubjects" multiple placeholder="Select subjects from Master" panelClass="smooth-dropdown-panel subject-multiselect-panel">
                <mat-select-trigger>
                  <mat-chip-set>
                    <mat-chip *ngFor="let subj of batchForm.get('selectedSubjects')?.value" selected color="primary" class="selected-chip">
                      {{ subj }}
                    </mat-chip>
                  </mat-chip-set>
                </mat-select-trigger>

                <!-- Sticky Search & Select All Header Box -->
                <div class="dropdown-header-container" (keydown)="$event.stopPropagation()">
                  <div class="dropdown-search-box">
                    <mat-icon class="search-icon">search</mat-icon>
                    <input
                      type="text"
                      class="search-input"
                      placeholder="Search subjects..."
                      [(ngModel)]="subjectSearchTerm"
                      [ngModelOptions]="{standalone: true}"
                      (input)="$event.stopPropagation()"
                    />
                    <mat-icon *ngIf="subjectSearchTerm" class="clear-icon" (click)="subjectSearchTerm = ''; $event.stopPropagation()">close</mat-icon>
                  </div>
                  
                  <div class="select-all-box">
                    <mat-checkbox
                      color="primary"
                      [checked]="isAllSubjectsSelected()"
                      [indeterminate]="isSomeSubjectsSelected()"
                      (change)="toggleSelectAllSubjects($event.checked)"
                      (click)="$event.stopPropagation()">
                      <span class="select-all-label">Select All / Unselect All</span>
                    </mat-checkbox>
                  </div>
                </div>

                <!-- Filtered Subject Options -->
                <mat-option *ngFor="let s of getFilteredSubjects()" [value]="s.name">
                  <mat-icon color="primary" class="option-icon">menu_book</mat-icon>
                  <span>{{ s.name }}</span>
                  <small class="option-code">({{ s.code || 'GEN' }})</small>
                </mat-option>

                <mat-option *ngIf="getFilteredSubjects().length === 0" disabled>
                  <em>No matching subjects found</em>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">category</mat-icon>
              <mat-error *ngIf="batchForm.get('selectedSubjects')?.hasError('required')">At least one subject is required</mat-error>
            </mat-form-field>
          </div>

          <!-- Section: Campus & Room -->
          <div class="section-label">
            <mat-icon class="section-icon">storefront</mat-icon>
            <span>Campus &amp; Classroom Allocation</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Branch Campus</mat-label>
              <mat-select formControlName="branchId" (selectionChange)="onBranchChange($event.value)" placeholder="Select Branch" panelClass="smooth-dropdown-panel batch-select-panel">
                <mat-select-trigger>
                  {{ getSelectedBranchName() }}
                </mat-select-trigger>
                <mat-option *ngFor="let b of availableBranches" [value]="b.id">
                  <div class="batch-opt-row">
                    <mat-icon color="primary" class="option-icon">store</mat-icon>
                    <span class="opt-name">{{ b.name }}</span>
                    <span class="opt-code-badge">{{ b.code }}</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">storefront</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Assigned Classroom (Room)</mat-label>
              <mat-select formControlName="roomId" placeholder="Select Room (Optional)" panelClass="smooth-dropdown-panel batch-select-panel">
                <mat-select-trigger>
                  {{ getSelectedRoomName() }}
                </mat-select-trigger>
                <mat-option [value]="null">
                  <div class="batch-opt-row">
                    <mat-icon class="option-icon text-muted">meeting_room</mat-icon>
                    <span class="text-muted">None / Unassigned</span>
                  </div>
                </mat-option>
                <mat-option *ngFor="let r of filteredRooms" [value]="r.id">
                  <div class="batch-opt-row">
                    <mat-icon color="primary" class="option-icon">meeting_room</mat-icon>
                    <span class="opt-name">{{ formatRoomDisplay(r.roomNumber) }}</span>
                    <span class="opt-badge-pill">Cap: {{ r.capacity }}</span>
                    <span class="opt-sub-info" *ngIf="r.floor">Floor {{ r.floor }}</span>
                  </div>
                </mat-option>
              </mat-select>
              <mat-icon matSuffix color="primary">meeting_room</mat-icon>
            </mat-form-field>
          </div>

          <!-- Section: Session & Fee -->
          <div class="section-label">
            <mat-icon class="section-icon">payments</mat-icon>
            <span>Academic Session &amp; Tuition Fee Rate</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Academic Session / Year *</mat-label>
              <input matInput formControlName="academicYear" placeholder="e.g. 2026-2027" />
              <mat-icon matSuffix color="primary">date_range</mat-icon>
              <mat-error *ngIf="batchForm.get('academicYear')?.hasError('required')">Academic Year is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Standard Monthly Fee (₹) *</mat-label>
              <input matInput type="number" formControlName="standardMonthlyFee" placeholder="3500" />
              <mat-icon matSuffix color="primary">payments</mat-icon>
              <mat-error *ngIf="batchForm.get('standardMonthlyFee')?.hasError('required')">Monthly fee is required</mat-error>
              <mat-error *ngIf="batchForm.get('standardMonthlyFee')?.hasError('min')">Fee must be positive</mat-error>
            </mat-form-field>
          </div>

          <!-- Live Preview Card -->
          <div class="preview-box">
            <div class="preview-header">
              <mat-icon class="preview-header-icon">summarize</mat-icon>
              <span>Batch Summary Preview</span>
            </div>
            <div class="preview-body">
              <div class="preview-item">
                <span class="preview-label">Batch Name:</span>
                <strong class="preview-val highlight">{{ batchForm.get('name')?.value || '—' }}</strong>
              </div>
              <div class="preview-item">
                <span class="preview-label">Covered Subjects:</span>
                <span class="preview-val">{{ getSelectedSubjects().join(', ') || 'None selected' }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">Campus &amp; Room:</span>
                <span class="preview-val">{{ getSelectedBranchName() || 'All Campuses' }} • {{ getSelectedRoomName() }}</span>
              </div>
              <div class="preview-item">
                <span class="preview-label">Tuition Fee Rate:</span>
                <strong class="preview-val amount">₹{{ (batchForm.get('standardMonthlyFee')?.value || 0) | number:'1.0-0' }} / mo ({{ batchForm.get('academicYear')?.value || '2026-2027' }})</strong>
              </div>
            </div>
          </div>

        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="onCancel()" [disabled]="saving">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="batchForm.invalid || saving || loading" class="submit-btn">
            <mat-spinner diameter="18" *ngIf="saving" class="btn-spinner"></mat-spinner>
            <mat-icon *ngIf="!saving">{{ isEditMode ? 'save' : 'add_task' }}</mat-icon>
            <span>{{ saving ? 'Saving...' : (isEditMode ? 'Update Batch' : 'Create Batch') }}</span>
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-wrapper {
      padding: 0;
      box-sizing: border-box;
      min-width: 520px;
      max-width: 660px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 24px 16px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;

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
        .main-title {
          margin: 0;
          font-size: 1.18rem;
          font-weight: 700;
          color: #1e3a8a;
          line-height: 1.3;
        }
        .subtitle {
          margin: 3px 0 0;
          font-size: 0.79rem;
          color: #3b82f6;
        }
      }

      .close-btn { color: #64748b; }
    }

    .dialog-loader {
      margin: 0;
      height: 3px;
    }

    .dialog-content {
      padding: 18px 24px 10px !important;
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 68vh;
      overflow-y: auto;
    }

    .info-callout {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 13px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;

      .info-icon { color: #16a34a; font-size: 18px; width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
      .info-text { font-size: 0.79rem; color: #166534; line-height: 1.45; strong { font-weight: 700; } }
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      margin-bottom: -4px;

      .section-icon { font-size: 15px; width: 15px; height: 15px; color: #94a3b8; }
    }

    .form-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .full-width {
      width: 100%;
      flex: 1 1 100%;
    }
    .half-width {
      flex: 1 1 calc(50% - 6px);
      min-width: 240px;
    }

    .selected-chip {
      font-size: 0.75rem;
      height: 22px;
    }

    .dropdown-header-container {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dropdown-search-box {
      display: flex;
      align-items: center;
      background: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 4px 8px;

      .search-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #666;
        margin-right: 6px;
      }
      .search-input {
        border: none;
        outline: none;
        background: transparent;
        width: 100%;
        font-size: 0.85rem;
      }
      .clear-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #999;
        cursor: pointer;
      }
    }
    .select-all-box {
      padding: 2px 4px;
      .select-all-label {
        font-weight: 600;
        font-size: 0.85rem;
        color: #1976d2;
      }
    }
    .option-icon {
      font-size: 18px;
      vertical-align: middle;
      margin-right: 6px;
    }
    .option-code {
      color: #888;
      margin-left: 6px;
    }
    .batch-opt-row {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      .opt-name { font-weight: 500; }
      .opt-code-badge, .opt-badge-pill {
        font-size: 0.72rem;
        background: #e2e8f0;
        color: #475569;
        padding: 1px 6px;
        border-radius: 4px;
        margin-left: auto;
      }
      .opt-sub-info {
        font-size: 0.72rem;
        color: #64748b;
        margin-left: 4px;
      }
    }

    .preview-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;

      .preview-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.73rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        .preview-header-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      }

      .preview-body {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        .preview-label { color: #64748b; }
        .preview-val {
          color: #0f172a;
          font-weight: 600;
          max-width: 62%;
          text-align: right;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          &.highlight { color: #2563eb; }
          &.amount { color: #059669; font-size: 0.95rem; }
        }
      }
    }

    .dialog-actions {
      padding: 13px 24px 20px;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      gap: 10px;

      .submit-btn {
        height: 42px;
        font-weight: 600;
        padding: 0 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .btn-spinner { margin-right: 4px; }
    }

    @media (max-width: 600px) {
      .dialog-wrapper { min-width: 100% !important; }
      .form-grid {
        flex-direction: column;
        .half-width, .full-width { width: 100% !important; flex: 1 1 100% !important; }
      }
    }
  `]
})
export class BatchDialogComponent implements OnInit {
  batchForm!: FormGroup;
  isEditMode = false;
  saving = false;
  loading = false;
  availableSubjects: SubjectDto[] = [];
  availableBranches: BranchDto[] = [];
  availableRooms: RoomDto[] = [];
  filteredRooms: RoomDto[] = [];
  subjectSearchTerm = '';

  constructor(
    private fb: FormBuilder,
    private batchesService: BatchesService,
    private subjectsService: SubjectsService,
    private branchService: BranchService,
    private roomService: RoomService,
    private authService: AuthService,
    private dialogRef: MatDialogRef<BatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: BatchDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    let initialSubjectList: string[] = [];
    if (this.data?.subject) {
      initialSubjectList = this.data.subject.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    const headerBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId;
    const initialBranchId = this.data?.branchId || (!this.isEditMode ? headerBranchId : null);

    this.batchForm = this.fb.group({
      name: [this.data?.name || '', [Validators.required, Validators.maxLength(200)]],
      selectedSubjects: [initialSubjectList, [Validators.required]],
      branchId: [initialBranchId || null],
      roomId: [this.data?.roomId || null],
      academicYear: [this.data?.academicYear || '2026-2027', [Validators.required]],
      standardMonthlyFee: [this.data?.standardMonthlyFee || 3500, [Validators.required, Validators.min(0)]]
    });

    this.loading = true;
    forkJoin({
      subjects: this.subjectsService.getSubjects(true).pipe(catchError(() => of([]))),
      branches: this.branchService.getBranches().pipe(catchError(() => of([]))),
      rooms: this.roomService.getRooms().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ subjects, branches, rooms }) => {
        this.availableSubjects = subjects;
        this.availableBranches = branches;
        this.availableRooms = rooms;

        // Auto-select header toolbar's selected branch when creating a new batch
        if (!this.isEditMode) {
          const matchingBranch = headerBranchId
            ? branches.find(b => b.id?.toLowerCase() === headerBranchId.toLowerCase())
            : null;
          const targetBranch = matchingBranch || branches.find(b => b.isMainBranch) || branches[0];
          if (targetBranch) {
            this.batchForm.patchValue({ branchId: targetBranch.id });
          }
        }

        this.filterRooms();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onBranchChange(branchId: string): void {
    const currentRoomId = this.batchForm.get('roomId')?.value;
    if (currentRoomId) {
      const room = this.availableRooms.find(r => r.id === currentRoomId);
      if (room && room.branchId !== branchId) {
        this.batchForm.patchValue({ roomId: null });
      }
    }
    this.filterRooms();
  }

  filterRooms(): void {
    const selectedBranch = this.batchForm.get('branchId')?.value;
    if (!selectedBranch) {
      this.filteredRooms = this.availableRooms;
    } else {
      this.filteredRooms = this.availableRooms.filter(r => r.branchId === selectedBranch);
    }
  }

  getSelectedBranchName(): string {
    const branchId = this.batchForm?.get('branchId')?.value;
    if (!branchId) return '';
    const b = this.availableBranches.find(x => x.id === branchId);
    return b ? `${b.name} (${b.code})` : '';
  }

  getSelectedRoomName(): string {
    const roomId = this.batchForm?.get('roomId')?.value;
    if (!roomId) return 'None / Unassigned';
    const r = this.filteredRooms.find(x => x.id === roomId);
    if (!r) return '';
    return `${this.formatRoomDisplay(r.roomNumber)}${r.capacity ? ' (Cap: ' + r.capacity + ')' : ''}`;
  }

  formatRoomDisplay(roomNumber?: string | null): string {
    if (!roomNumber) return '';
    const trimmed = roomNumber.trim();
    if (trimmed.toLowerCase().startsWith('room')) {
      return trimmed;
    }
    return `Room ${trimmed}`;
  }

  getFilteredSubjects(): SubjectDto[] {
    if (!this.subjectSearchTerm) {
      return this.availableSubjects;
    }
    const term = this.subjectSearchTerm.toLowerCase().trim();
    return this.availableSubjects.filter(s =>
      s.name.toLowerCase().includes(term) || (s.code && s.code.toLowerCase().includes(term))
    );
  }

  getSelectedSubjects(): string[] {
    return this.batchForm.get('selectedSubjects')?.value || [];
  }

  isAllSubjectsSelected(): boolean {
    const filtered = this.getFilteredSubjects();
    if (filtered.length === 0) return false;
    const selected = this.getSelectedSubjects();
    return filtered.every(s => selected.includes(s.name));
  }

  isSomeSubjectsSelected(): boolean {
    const filtered = this.getFilteredSubjects();
    if (filtered.length === 0) return false;
    const selected = this.getSelectedSubjects();
    const count = filtered.filter(s => selected.includes(s.name)).length;
    return count > 0 && count < filtered.length;
  }

  toggleSelectAllSubjects(checked: boolean): void {
    const filteredNames = this.getFilteredSubjects().map(s => s.name);
    let currentSelected = [...this.getSelectedSubjects()];

    if (checked) {
      filteredNames.forEach(name => {
        if (!currentSelected.includes(name)) {
          currentSelected.push(name);
        }
      });
    } else {
      currentSelected = currentSelected.filter(name => !filteredNames.includes(name));
    }

    this.batchForm.get('selectedSubjects')?.setValue(currentSelected);
    this.batchForm.get('selectedSubjects')?.markAsDirty();
  }

  onSubmit(): void {
    if (this.batchForm.invalid) return;

    this.saving = true;
    const formVal = this.batchForm.value;
    const subjectsArray: string[] = formVal.selectedSubjects || [];

    const payload = {
      name: formVal.name,
      subject: subjectsArray.join(', '),
      academicYear: formVal.academicYear,
      standardMonthlyFee: formVal.standardMonthlyFee,
      branchId: formVal.branchId || null,
      roomId: formVal.roomId || null
    };

    if (this.isEditMode && this.data?.id) {
      this.batchesService.updateBatch(this.data.id, payload).subscribe({
        next: (updated) => {
          this.saving = false;
          this.dialogRef.close(updated);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error updating batch');
        }
      });
    } else {
      this.batchesService.createBatch(payload).subscribe({
        next: (created) => {
          this.saving = false;
          this.dialogRef.close(created);
        },
        error: (err) => {
          this.saving = false;
          alert(err?.error?.message || 'Error creating batch');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
