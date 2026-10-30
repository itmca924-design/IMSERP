import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
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
import { SchoolClassDto, SchoolService } from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { CoachingService } from '../../core/services/coaching.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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
              <strong>Academic Batch Setup:</strong> Link subjects, allocate classroom capacity, and assign mentor teachers.
            </div>
          </div>

          <!-- Section: Batch Info & Subjects -->
          <div class="section-label">
            <mat-icon class="section-icon">school</mat-icon>
            <span>Batch &amp; Subject Details</span>
          </div>

          <div class="form-grid">
            <!-- Batch Structure Scope Toggle Deck -->
            <div class="batch-scope-toggle-deck full-width">
              <span class="scope-deck-title">Batch Architecture / Scope (बैच का प्रकार):</span>
              <div class="scope-toggle-pills">
                <button
                  type="button"
                  class="scope-pill-btn"
                  [class.active]="batchScope === 'single'"
                  (click)="setBatchScope('single')"
                >
                  <mat-icon>school</mat-icon>
                  <div class="pill-texts">
                    <span class="pill-main">Single Class Batch (एकल कक्षा)</span>
                    <span class="pill-sub">बड़े कोचिंग / Specific Class (e.g. Class 5th Special)</span>
                  </div>
                </button>

                <button
                  type="button"
                  class="scope-pill-btn"
                  [class.active]="batchScope === 'combined'"
                  (click)="setBatchScope('combined')"
                >
                  <mat-icon>layers</mat-icon>
                  <div class="pill-texts">
                    <span class="pill-main">Combined / Multi-Class Range (संयुक्त कक्षा)</span>
                    <span class="pill-sub">छोटे कोचिंग / 1st to 5th Foundation Combined</span>
                  </div>
                </button>
              </div>
            </div>

            <div class="row-quick-header full-width">
              <span class="row-hint-text">{{ batchScope === 'single' ? 'Choose Academic Class & Timing' : 'Configure Class Range & Timing' }}</span>
              <div class="shift-quick-pills">
                <button
                  type="button"
                  class="quick-add-link-btn"
                  [class.active]="showQuickAddClass"
                  (click)="toggleQuickAddClass()"
                  title="Quick Add Higher Class (6th to 12th) for Coaching"
                >
                  <mat-icon>{{ showQuickAddClass ? 'close' : 'add_circle' }}</mat-icon>
                  <span>{{ showQuickAddClass ? 'Close Quick Add' : '+ Add Coaching Class (6th to 12th)' }}</span>
                </button>
                <span class="shift-title">Shift:</span>
                <button type="button" class="shift-pill" [class.active]="selectedShift === 'Morning'" (click)="setBatchShift('Morning')">
                  ☀️ Morning
                </button>
                <button type="button" class="shift-pill" [class.active]="selectedShift === 'Evening'" (click)="setBatchShift('Evening')">
                  🌇 Evening
                </button>
                <button type="button" class="shift-pill" [class.active]="selectedShift === 'Afternoon'" (click)="setBatchShift('Afternoon')">
                  🕒 Afternoon
                </button>
              </div>
            </div>

            <!-- Batch Shift & Timings Quick Bar -->
            <div class="batch-timing-bar full-width">
              <div class="timing-bar-left">
                <mat-icon class="timing-bar-icon">schedule</mat-icon>
                <span class="timing-bar-label">Batch Timing (बैच समय):</span>
              </div>
              <div class="timing-bar-fields">
                <div class="time-field-box">
                  <span class="tf-label">Start Time</span>
                  <input type="time" formControlName="startTime" class="timing-input" />
                </div>
                <span class="tf-sep">➔</span>
                <div class="time-field-box">
                  <span class="tf-label">End Time</span>
                  <input type="time" formControlName="endTime" class="timing-input" />
                </div>
                <span class="batch-dur-pill" *ngIf="getBatchCalculatedDuration()">
                  ⏱️ {{ getBatchCalculatedDuration() }}
                </span>
              </div>
            </div>

            <!-- Quick Add Coaching Class Inline Expansion Card -->
            <div class="quick-add-class-card full-width" *ngIf="showQuickAddClass">
              <div class="quick-add-header">
                <div class="quick-add-title-wrap">
                  <div class="quick-add-icon-wrap">
                    <mat-icon>auto_stories</mat-icon>
                  </div>
                  <div>
                    <span class="card-title">Quick Add Coaching Class (उच्च कक्षा जोड़ें)</span>
                    <span class="card-hint">Adds a coaching-eligible class (Scope: Coaching) instantly without leaving this dialog.</span>
                  </div>
                </div>
                <button type="button" mat-icon-button class="mini-close" (click)="showQuickAddClass = false" [disabled]="quickClassSaving">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- 1-Click Suggestions Chips -->
              <div class="quick-suggestions-wrap" *ngIf="getMissingSuggestedClasses().length > 0">
                <span class="suggestions-label">⚡ 1-Click Quick Add:</span>
                <div class="suggestion-chips">
                  <button
                    *ngFor="let sug of getMissingSuggestedClasses()"
                    type="button"
                    class="sug-chip-btn"
                    [disabled]="quickClassSaving"
                    (click)="quickCreateClass(sug)"
                  >
                    <mat-icon>add</mat-icon> {{ sug }}
                  </button>
                </div>
              </div>

              <!-- Custom Class Name Input -->
              <div class="custom-quick-row">
                <div class="quick-input-box">
                  <mat-icon class="input-icon">edit</mat-icon>
                  <input
                    type="text"
                    class="quick-class-input"
                    placeholder="Or enter class name (e.g. Class 7th, Class 10th CBSE)..."
                    [(ngModel)]="quickClassName"
                    [ngModelOptions]="{standalone: true}"
                    (keydown.enter)="$event.preventDefault(); quickCreateClass(quickClassName)"
                    [disabled]="quickClassSaving"
                  />
                  <mat-icon *ngIf="quickClassName" class="clear-icon" (click)="quickClassName = ''">close</mat-icon>
                </div>
                <button
                  type="button"
                  mat-raised-button
                  color="primary"
                  class="quick-submit-btn"
                  [disabled]="!quickClassName.trim() || quickClassSaving"
                  (click)="quickCreateClass(quickClassName)"
                >
                  <mat-spinner diameter="16" *ngIf="quickClassSaving"></mat-spinner>
                  <mat-icon *ngIf="!quickClassSaving">add_circle</mat-icon>
                  <span>{{ quickClassSaving ? 'Adding...' : 'Add & Select' }}</span>
                </button>
              </div>
            </div>

            <!-- Single Class Selector -->
            <mat-form-field appearance="outline" class="half-width" *ngIf="batchScope === 'single'">
              <mat-label>Target Academic Class (कक्षा) *</mat-label>
              <mat-select formControlName="classId" placeholder="Select Class" (selectionChange)="onClassSelectionChanged($event.value)" panelClass="smooth-dropdown-panel batch-select-panel" (openedChange)="onClassDropdownOpened($event)">
                <mat-select-trigger>
                  {{ getSelectedClassName() || 'Select Class' }}
                </mat-select-trigger>

                <!-- Sticky Search Box for Target Academic Class -->
                <div class="dropdown-header-container" (keydown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
                  <div class="dropdown-search-box">
                    <mat-icon class="search-icon">search</mat-icon>
                    <input
                      #classSearchInput
                      type="text"
                      class="search-input"
                      placeholder="Search class (e.g. 5th, 10th, 12th)..."
                      [(ngModel)]="classSearchTerm"
                      [ngModelOptions]="{standalone: true}"
                      (input)="$event.stopPropagation()"
                      (keydown)="$event.stopPropagation()"
                    />
                    <mat-icon *ngIf="classSearchTerm" class="clear-icon" (click)="classSearchTerm = ''; $event.stopPropagation()">close</mat-icon>
                  </div>
                  <div class="dropdown-quick-create-bar" (click)="openQuickAddClassFromDropdown($event)">
                    <mat-icon class="bar-icon">add_circle</mat-icon>
                    <span>Can't find class? <strong>+ Quick Add Coaching Class (6th–12th)</strong></span>
                  </div>
                </div>

                <mat-option *ngFor="let c of getFilteredClasses()" [value]="c.id">
                  <div class="batch-opt-row">
                    <mat-icon color="primary" class="option-icon">class</mat-icon>
                    <span class="opt-name">{{ c.name }}</span>
                    <span class="opt-badge-pill" *ngIf="c.academicScope === 'Coaching'">Coaching</span>
                    <span class="opt-code-badge" *ngIf="c.code">{{ c.code }}</span>
                  </div>
                </mat-option>
                <div class="dropdown-empty-state" *ngIf="getFilteredClasses().length === 0 && classSearchTerm">
                  <mat-icon class="empty-icon">search_off</mat-icon>
                  <div class="empty-col">
                    <span>No class found matching "{{ classSearchTerm }}"</span>
                    <button type="button" class="empty-add-btn" (click)="quickCreateClassFromSearch(classSearchTerm); $event.stopPropagation()">
                      <mat-icon>add</mat-icon> Quick Add "{{ getCleanClassSuggestion(classSearchTerm) }}" as Coaching Class
                    </button>
                  </div>
                </div>
              </mat-select>
              <mat-icon matSuffix color="primary">class</mat-icon>
              <mat-error *ngIf="batchScope === 'single' && batchForm.get('classId')?.hasError('required')">Academic Class is required for Single Class batch</mat-error>
            </mat-form-field>

            <!-- Combined Multi-Class Range Selectors -->
            <div class="half-width combined-range-row" *ngIf="batchScope === 'combined'">
              <mat-form-field appearance="outline" class="range-sub-field">
                <mat-label>From Class (कक्षा से)</mat-label>
                <mat-select [value]="rangeFromClassId" (selectionChange)="onRangeFromChange($event.value)" panelClass="smooth-dropdown-panel">
                  <mat-option *ngFor="let c of availableClasses" [value]="c.id">
                    {{ c.name }}
                  </mat-option>
                </mat-select>
                <mat-icon matSuffix color="primary">first_page</mat-icon>
              </mat-form-field>

              <span class="range-sep-arrow">➔</span>

              <mat-form-field appearance="outline" class="range-sub-field">
                <mat-label>To Class (कक्षा तक)</mat-label>
                <mat-select [value]="rangeToClassId" (selectionChange)="onRangeToChange($event.value)" panelClass="smooth-dropdown-panel">
                  <mat-option *ngFor="let c of availableClasses" [value]="c.id">
                    {{ c.name }}
                  </mat-option>
                </mat-select>
                <mat-icon matSuffix color="primary">last_page</mat-icon>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Batch Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. Class 5th - Morning Coaching Batch" />
              <mat-icon matSuffix color="primary">school</mat-icon>
              <mat-error *ngIf="batchForm.get('name')?.hasError('required')">Batch name is required</mat-error>
            </mat-form-field>

            <div class="full-width subjects-field-wrap">
              <div class="subject-quick-actions" *ngIf="availableSubjects.length > 0">
                <span class="quick-title">Quick Selection:</span>
                <button type="button" class="quick-pill-btn" (click)="selectAllSubjectsOneClick()">
                  <mat-icon>done_all</mat-icon> All Subjects (सभी विषय)
                </button>
                <button type="button" class="quick-pill-btn clear" *ngIf="getSelectedSubjects().length > 0" (click)="clearAllSubjectsOneClick()">
                  <mat-icon>clear</mat-icon> Clear All
                </button>
              </div>

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

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Batch Mentor / In-charge Faculty (बैच मेंटर / प्रभारी शिक्षक)</mat-label>
              <mat-select formControlName="mentorTeacherId" placeholder="Select Faculty In-charge (Optional)" panelClass="smooth-dropdown-panel batch-select-panel" (openedChange)="onTeacherDropdownOpened($event)">
                <mat-select-trigger>
                  {{ getSelectedMentorName() }}
                </mat-select-trigger>

                <!-- Sticky Search Box for Faculty / Mentor -->
                <div class="dropdown-header-container" (keydown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
                  <div class="dropdown-search-box">
                    <mat-icon class="search-icon">search</mat-icon>
                    <input
                      #teacherSearchInput
                      type="text"
                      class="search-input"
                      placeholder="Search faculty by name, subject, or phone..."
                      [(ngModel)]="teacherSearchTerm"
                      [ngModelOptions]="{standalone: true}"
                      (input)="$event.stopPropagation()"
                      (keydown)="$event.stopPropagation()"
                    />
                    <mat-icon *ngIf="teacherSearchTerm" class="clear-icon" (click)="teacherSearchTerm = ''; $event.stopPropagation()">close</mat-icon>
                  </div>
                </div>

                <mat-option [value]="null" *ngIf="!teacherSearchTerm || 'none unassigned'.includes(teacherSearchTerm.toLowerCase())">
                  <div class="batch-opt-row">
                    <mat-icon class="option-icon text-muted">person_off</mat-icon>
                    <span class="text-muted">None / Unassigned (कोई मेंटर नहीं)</span>
                  </div>
                </mat-option>
                <mat-option *ngFor="let t of getFilteredTeachers()" [value]="t.id">
                  <div class="batch-opt-row">
                    <mat-icon color="primary" class="option-icon">supervisor_account</mat-icon>
                    <span class="opt-name">{{ t.fullName || t.name }}</span>
                    <span class="opt-code-badge" *ngIf="t.specialization || t.department || t.designation || t.subject">{{ t.specialization || t.department || t.designation || t.subject }}</span>
                    <span class="opt-sub-info" *ngIf="t.phoneNumber || t.phone">📞 {{ t.phoneNumber || t.phone }}</span>
                  </div>
                </mat-option>
                <div class="dropdown-empty-state" *ngIf="getFilteredTeachers().length === 0 && teacherSearchTerm">
                  <mat-icon class="empty-icon">search_off</mat-icon>
                  <span>No faculty found matching "{{ teacherSearchTerm }}"</span>
                </div>
              </mat-select>
              <mat-icon matSuffix color="primary">supervisor_account</mat-icon>
            </mat-form-field>
          </div>

          <!-- Section: Academic Session -->
          <div class="section-label">
            <mat-icon class="section-icon">date_range</mat-icon>
            <span>Academic Session</span>
          </div>

          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Academic Session / Year *</mat-label>
              <input matInput formControlName="academicYear" placeholder="e.g. 2026-2027" />
              <mat-icon matSuffix color="primary">date_range</mat-icon>
              <mat-error *ngIf="batchForm.get('academicYear')?.hasError('required')">Academic Year is required</mat-error>
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
                <span class="preview-label">Academic Scope:</span>
                <span class="preview-val highlight">
                  {{ batchScope === 'single' ? ('Single Class (' + (getSelectedClassName() || 'Not selected') + ')') : ('Combined Multi-Class (' + getCombinedRangeLabel() + ')') }}
                </span>
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
                <span class="preview-label">Academic Session:</span>
                <strong class="preview-val">{{ batchForm.get('academicYear')?.value || '2026-2027' }}</strong>
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
      width: 100%;
      max-width: 880px;
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
    .batch-scope-toggle-deck {
      background: linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%);
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 2px;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .scope-deck-title {
        font-size: 0.74rem;
        font-weight: 700;
        color: #1e40af;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .scope-toggle-pills {
        display: flex;
        gap: 10px;

        @media (max-width: 600px) {
          flex-direction: column;
        }

        .scope-pill-btn {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #ffffff;
          border: 1.5px solid #cbd5e1;
          border-radius: 10px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;

          mat-icon {
            font-size: 22px;
            width: 22px;
            height: 22px;
            color: #64748b;
          }

          .pill-texts {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .pill-main {
              font-size: 0.82rem;
              font-weight: 700;
              color: #334155;
            }

            .pill-sub {
              font-size: 0.70rem;
              color: #64748b;
              font-weight: 500;
            }
          }

          &:hover {
            border-color: #3b82f6;
            background: #f8fafc;
          }

          &.active {
            background: #ffffff;
            border-color: #2563eb;
            box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15), 0 2px 4px -2px rgba(37, 99, 235, 0.1);

            mat-icon {
              color: #2563eb;
            }

            .pill-main {
              color: #1e40af;
            }

            .pill-sub {
              color: #2563eb;
            }
          }
        }
      }
    }

    .combined-range-row {
      display: flex;
      align-items: center;
      gap: 10px;

      .range-sub-field {
        flex: 1;
        min-width: 150px;
        margin-bottom: 0;
      }

      .range-sep-arrow {
        color: #2563eb;
        font-weight: 800;
        font-size: 1.15rem;
        padding-bottom: 18px;
        flex-shrink: 0;
      }
    }

    .row-quick-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 2px 2px;
      margin-bottom: -4px;

      .row-hint-text {
        font-size: 0.72rem;
        font-weight: 600;
        color: #64748b;
      }
    }
    .half-width {
      flex: 1 1 calc(50% - 6px);
      min-width: 240px;
    }
    .shift-quick-pills {
      display: flex;
      align-items: center;
      gap: 6px;

      .shift-title {
        font-size: 0.72rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .shift-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 2px 8px;
        background: #f1f5f9;
        border: 1px solid #cbd5e1;
        color: #475569;
        border-radius: 12px;
        font-size: 0.73rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        &.active {
          background: #eff6ff;
          border-color: #2563eb;
          color: #1e40af;
          box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
        }
      }
    }

    .batch-timing-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      padding: 8px 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-top: 2px;
      margin-bottom: 6px;

      .timing-bar-left {
        display: flex;
        align-items: center;
        gap: 6px;

        .timing-bar-icon {
          color: #2563eb;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .timing-bar-label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #334155;
        }
      }

      .timing-bar-fields {
        display: flex;
        align-items: center;
        gap: 8px;

        .time-field-box {
          display: flex;
          align-items: center;
          gap: 6px;

          .tf-label {
            font-size: 0.72rem;
            font-weight: 600;
            color: #64748b;
          }

          .timing-input {
            padding: 4px 8px;
            font-size: 0.82rem;
            font-weight: 600;
            color: #1e293b;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            outline: none;
            transition: border-color 0.15s ease;

            &:focus {
              border-color: #2563eb;
              box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
            }
          }
        }

        .tf-sep {
          color: #94a3b8;
          font-weight: 600;
          font-size: 0.8rem;
        }

        .batch-dur-pill {
          padding: 3px 8px;
          background: #dbeafe;
          color: #1e40af;
          border-radius: 12px;
          font-size: 0.72rem;
          font-weight: 700;
        }
      }
    }

    .subjects-field-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .subject-quick-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;

      .quick-title {
        font-size: 0.74rem;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .quick-pill-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        color: #1e40af;
        border-radius: 14px;
        font-size: 0.76rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s ease;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }

        &:hover {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        &.clear {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;

          &:hover {
            background: #fee2e2;
            border-color: #fca5a5;
          }
        }
      }
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

    .quick-add-link-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      border-radius: 12px;
      font-size: 0.73rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
      }

      &:hover {
        background: #dbeafe;
        border-color: #93c5fd;
      }

      &.active {
        background: #fee2e2;
        border-color: #fca5a5;
        color: #991b1b;
      }
    }

    .quick-add-class-card {
      background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%);
      border: 1.5px solid #bfdbfe;
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.08);
      display: flex;
      flex-direction: column;
      gap: 10px;
      animation: fadeIn 0.2s ease-in-out;

      .quick-add-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        .quick-add-title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;

          .quick-add-icon-wrap {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: #2563eb;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
          }

          .card-title {
            font-size: 0.83rem;
            font-weight: 700;
            color: #1e3a8a;
            display: block;
          }

          .card-hint {
            font-size: 0.70rem;
            color: #64748b;
            display: block;
          }
        }

        .mini-close {
          width: 28px;
          height: 28px;
          line-height: 28px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
        }
      }

      .quick-suggestions-wrap {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .suggestions-label {
          font-size: 0.70rem;
          font-weight: 700;
          color: #1e40af;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .suggestion-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;

          .sug-chip-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 10px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            color: #1e40af;
            border-radius: 14px;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;

            mat-icon { font-size: 13px; width: 13px; height: 13px; color: #2563eb; }

            &:hover {
              background: #eff6ff;
              border-color: #2563eb;
              transform: translateY(-1px);
              box-shadow: 0 2px 4px rgba(37, 99, 235, 0.15);
            }
          }
        }
      }

      .custom-quick-row {
        display: flex;
        align-items: center;
        gap: 8px;

        .quick-input-box {
          flex: 1;
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 5px 10px;

          .input-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; margin-right: 6px; }
          .quick-class-input {
            border: none;
            outline: none;
            background: transparent;
            width: 100%;
            font-size: 0.82rem;
            font-weight: 500;
          }
          .clear-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; cursor: pointer; }
        }

        .quick-submit-btn {
          height: 34px;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 0 14px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }

    .dropdown-quick-create-bar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      font-size: 0.75rem;
      color: #1e40af;
      cursor: pointer;
      margin-top: 4px;
      transition: background 0.15s ease;

      .bar-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; flex-shrink: 0; }

      &:hover {
        background: #dbeafe;
      }
    }

    .dropdown-empty-state {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      color: #64748b;
      font-size: 0.85rem;
      font-style: italic;
      .empty-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }

      .empty-col {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
      }

      .empty-add-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        font-style: normal;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
        &:hover { background: #1d4ed8; }
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

    @media (max-width: 768px) {
      .dialog-wrapper { width: 100% !important; max-width: 100% !important; }
      .form-grid {
        flex-direction: column;
        .half-width, .full-width { width: 100% !important; flex: 1 1 100% !important; min-width: 0 !important; }
      }
      .combined-range-row {
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        .range-sep-arrow {
          display: none;
        }
      }
    }
  `]
})
export class BatchDialogComponent implements OnInit {
  batchForm!: FormGroup;
  isEditMode = false;
  saving = false;
  loading = false;
  batchScope: 'single' | 'combined' = 'single';
  rangeFromClassId = '';
  rangeToClassId = '';
  availableSubjects: SubjectDto[] = [];
  availableBranches: BranchDto[] = [];
  availableRooms: RoomDto[] = [];
  filteredRooms: RoomDto[] = [];
  availableClasses: SchoolClassDto[] = [];
  filteredClasses: SchoolClassDto[] = [];
  availableTeachers: any[] = [];
  subjectSearchTerm = '';
  classSearchTerm = '';
  teacherSearchTerm = '';
  selectedShift: 'Morning' | 'Evening' | 'Afternoon' = 'Morning';
  @ViewChild('classSearchInput') classSearchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('teacherSearchInput') teacherSearchInput?: ElementRef<HTMLInputElement>;

  getBatchCalculatedDuration(): string {
    const s = this.batchForm?.get('startTime')?.value;
    const e = this.batchForm?.get('endTime')?.value;
    if (!s || !e) return '';
    const sParts = s.split(':').map(Number);
    const eParts = e.split(':').map(Number);
    if (sParts.length < 2 || eParts.length < 2) return '';
    let startMin = sParts[0] * 60 + sParts[1];
    let endMin = eParts[0] * 60 + eParts[1];
    if (endMin <= startMin) endMin += 1440;
    const diff = endMin - startMin;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  getFilteredClasses(): SchoolClassDto[] {
    const term = (this.classSearchTerm || '').trim().toLowerCase();
    if (!term) return this.filteredClasses;
    return this.filteredClasses.filter(c =>
      (c.name || '').toLowerCase().includes(term) ||
      (c.code || '').toLowerCase().includes(term)
    );
  }

  getFilteredTeachers(): any[] {
    const term = (this.teacherSearchTerm || '').trim().toLowerCase();
    if (!term) return this.availableTeachers;
    return this.availableTeachers.filter(t => {
      const name = (t.fullName || t.name || '').toLowerCase();
      const spec = (t.specialization || t.department || t.designation || t.subject || '').toLowerCase();
      const phone = (t.phoneNumber || t.phone || '').toLowerCase();
      return name.includes(term) || spec.includes(term) || phone.includes(term);
    });
  }

  onTeacherDropdownOpened(opened: boolean): void {
    if (opened) {
      setTimeout(() => {
        this.teacherSearchInput?.nativeElement?.focus();
      }, 100);
    } else {
      this.teacherSearchTerm = '';
    }
  }

  showQuickAddClass = false;
  quickClassName = '';
  quickClassSaving = false;

  getMissingSuggestedClasses(): string[] {
    const standardCoachingClasses = [
      'Class 6th',
      'Class 7th',
      'Class 8th',
      'Class 9th',
      'Class 10th',
      'Class 11th',
      'Class 12th'
    ];
    const existingNames = this.availableClasses.map(c => (c.name || '').toLowerCase().trim());
    return standardCoachingClasses.filter(sug => !existingNames.includes(sug.toLowerCase().trim()));
  }

  toggleQuickAddClass(): void {
    this.showQuickAddClass = !this.showQuickAddClass;
    if (this.showQuickAddClass) {
      this.quickClassName = '';
    }
  }

  openQuickAddClassFromDropdown(event: Event): void {
    event.stopPropagation();
    this.showQuickAddClass = true;
    this.quickClassName = '';
  }

  getCleanClassSuggestion(term: string): string {
    const t = (term || '').trim();
    if (!t) return 'Class';
    if (t.toLowerCase().startsWith('class')) return t;
    return `Class ${t}`;
  }

  quickCreateClassFromSearch(term: string): void {
    const name = this.getCleanClassSuggestion(term);
    this.quickCreateClass(name);
  }

  quickCreateClass(className: string): void {
    const name = (className || '').trim();
    if (!name) return;

    // Check if already exists in availableClasses
    const existing = this.availableClasses.find(c => c.name.toLowerCase().trim() === name.toLowerCase());
    if (existing) {
      if (this.batchScope === 'single') {
        this.batchForm.patchValue({ classId: existing.id });
        this.onClassSelectionChanged(existing.id);
      }
      this.showQuickAddClass = false;
      return;
    }

    this.quickClassSaving = true;
    const highestDisplayOrder = this.availableClasses.reduce((max, c) => Math.max(max, c.displayOrder || 0), 0);
    const branchId = this.batchForm.get('branchId')?.value || undefined;

    this.schoolService.createClass({
      name,
      code: name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 10),
      academicScope: 'Coaching',
      displayOrder: highestDisplayOrder + 1,
      branchId
    }).subscribe({
      next: (created) => {
        this.availableClasses.push(created);
        this.availableClasses.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.filterClasses();

        if (this.batchScope === 'single') {
          this.batchForm.patchValue({ classId: created.id });
          this.onClassSelectionChanged(created.id);
        } else if (this.batchScope === 'combined') {
          if (!this.rangeToClassId || this.rangeToClassId === this.rangeFromClassId) {
            this.rangeToClassId = created.id;
            this.updateCombinedBatchName();
          }
        }

        this.quickClassName = '';
        this.classSearchTerm = '';
        this.quickClassSaving = false;
        this.showQuickAddClass = false;
      },
      error: (err) => {
        this.quickClassSaving = false;
        const msg = err?.error?.message || 'Failed to create coaching class.';
        this.confirmDialog.alert('Class Creation Failed', msg, 'danger');
      }
    });
  }

  onClassDropdownOpened(opened: boolean): void {
    if (opened) {
      setTimeout(() => {
        this.classSearchInput?.nativeElement?.focus();
      }, 100);
    } else {
      this.classSearchTerm = '';
    }
  }

  constructor(
    private fb: FormBuilder,
    private batchesService: BatchesService,
    private subjectsService: SubjectsService,
    private branchService: BranchService,
    private roomService: RoomService,
    private schoolService: SchoolService,
    private coachingService: CoachingService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private dialogRef: MatDialogRef<BatchDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data?: BatchDto
  ) {}

  ngOnInit(): void {
    this.isEditMode = !!this.data?.id;

    // Detect if batch is combined range or single class
    const hasRangeInName = !!(this.data?.name && this.data.name.match(/class\s*\d+.*(?:to|-).*\d+/i));
    const isClassNull = !this.data?.classId;
    this.batchScope = (hasRangeInName || isClassNull) ? 'combined' : 'single';

    let initialSubjectList: string[] = [];
    if (this.data?.subject) {
      initialSubjectList = this.data.subject.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    const headerBranchId = this.authService.selectedBranchId() || this.authService.currentUser()?.branchId;
    const initialBranchId = this.data?.branchId || (!this.isEditMode ? headerBranchId : null);

    const defaultShift = this.data?.shift || 'Morning';
    this.selectedShift = (defaultShift as any);
    const defaultStartTime = this.data?.startTime || (defaultShift === 'Evening' ? '16:00' : (defaultShift === 'Afternoon' ? '12:00' : '07:00'));
    const defaultEndTime = this.data?.endTime || (defaultShift === 'Evening' ? '19:00' : (defaultShift === 'Afternoon' ? '15:00' : '10:00'));

    this.batchForm = this.fb.group({
      name: [this.data?.name || '', [Validators.required, Validators.maxLength(200)]],
      classId: [this.data?.classId || null],
      selectedSubjects: [initialSubjectList, [Validators.required]],
      branchId: [initialBranchId || null],
      roomId: [this.data?.roomId || null],
      mentorTeacherId: [this.data?.mentorTeacherId || null],
      academicYear: [this.data?.academicYear || '2026-2027', [Validators.required]],
      shift: [defaultShift],
      startTime: [defaultStartTime],
      endTime: [defaultEndTime]
    });

    this.loading = true;
    forkJoin({
      subjects: this.subjectsService.getSubjects(true).pipe(catchError(() => of([]))),
      branches: this.branchService.getBranches().pipe(catchError(() => of([]))),
      rooms: this.roomService.getRooms().pipe(catchError(() => of([]))),
      classes: this.schoolService.getClasses(true, 'Coaching').pipe(catchError(() => of([]))),
      teachers: this.coachingService.getTeachers().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ subjects, branches, rooms, classes, teachers }) => {
        this.availableSubjects = subjects;
        this.availableBranches = branches;
        this.availableRooms = rooms;
        this.availableClasses = classes;
        this.availableTeachers = teachers;
        this.initClassRange();

        // Ensure any existing subjects from this batch are in availableSubjects
        if (initialSubjectList.length > 0) {
          for (const sName of initialSubjectList) {
            const exists = this.availableSubjects.some(s => s.name.toLowerCase() === sName.toLowerCase());
            if (!exists) {
              this.availableSubjects.push({
                id: sName,
                name: sName,
                code: sName.substring(0, 4).toUpperCase(),
                isActive: true
              } as any);
            }
          }
        }

        // Auto-select header toolbar's selected branch when creating a new batch
        if (!this.isEditMode) {
          const matchingBranch = headerBranchId
            ? branches.find(b => b.id?.toLowerCase() === headerBranchId.toLowerCase())
            : null;
          const targetBranch = matchingBranch || branches.find(b => b.isMainBranch) || branches[0];
          if (targetBranch) {
            this.batchForm.patchValue({ branchId: targetBranch.id });
          }
        } else {
          // Re-assert selectedSubjects, classId, and roomId after options are populated
          this.batchForm.patchValue({
            classId: this.data?.classId || null,
            selectedSubjects: initialSubjectList,
            roomId: this.data?.roomId || null
          });
        }

        this.filterRooms();
        this.filterClasses();
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
    this.filterClasses();
  }

  filterClasses(): void {
    const selectedBranch = this.batchForm.get('branchId')?.value;
    if (!selectedBranch) {
      this.filteredClasses = this.availableClasses;
    } else {
      const branchClasses = this.availableClasses.filter(c => !c.branchId || c.branchId === selectedBranch);
      this.filteredClasses = branchClasses.length > 0 ? branchClasses : this.availableClasses;
    }
  }

  filterRooms(): void {
    const selectedBranch = this.batchForm.get('branchId')?.value;
    if (!selectedBranch) {
      this.filteredRooms = this.availableRooms;
    } else {
      this.filteredRooms = this.availableRooms.filter(r => r.branchId === selectedBranch);
    }
  }

  getSelectedClassName(): string {
    const classId = this.batchForm?.get('classId')?.value;
    if (!classId) return '';
    const c = this.availableClasses.find(x => x.id === classId);
    return c ? c.name : (this.data?.className || '');
  }

  getSelectedBranchName(): string {
    const branchId = this.batchForm?.get('branchId')?.value;
    if (!branchId) return '';
    const b = this.availableBranches.find(x => x.id === branchId);
    return b ? `${b.name} (${b.code})` : '';
  }

  getSelectedMentorName(): string {
    const mentorId = this.batchForm?.get('mentorTeacherId')?.value;
    if (!mentorId) return 'None / Unassigned';
    const t = this.availableTeachers.find(x => x.id === mentorId);
    if (!t) return this.data?.mentorTeacherName || 'None / Unassigned';
    const name = t.fullName || t.name;
    const spec = t.specialization || t.department || t.designation || t.subject;
    return spec ? `${name} (${spec})` : name;
  }

  getSelectedRoomName(): string {
    const roomId = this.batchForm?.get('roomId')?.value;
    if (!roomId) return 'None / Unassigned';
    const r = this.filteredRooms.find(x => x.id === roomId) || this.availableRooms.find(x => x.id === roomId);
    if (!r) return 'None / Unassigned';
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

  selectAllSubjectsOneClick(): void {
    const allNames = this.availableSubjects.map(s => s.name);
    this.batchForm.get('selectedSubjects')?.setValue(allNames);
    this.batchForm.get('selectedSubjects')?.markAsDirty();
  }

  clearAllSubjectsOneClick(): void {
    this.batchForm.get('selectedSubjects')?.setValue([]);
    this.batchForm.get('selectedSubjects')?.markAsDirty();
  }

  setBatchShift(shift: 'Morning' | 'Evening' | 'Afternoon'): void {
    this.selectedShift = shift;
    this.batchForm.patchValue({ shift });
    if (shift === 'Morning') {
      this.batchForm.patchValue({ startTime: '07:00', endTime: '10:00' });
    } else if (shift === 'Afternoon') {
      this.batchForm.patchValue({ startTime: '12:00', endTime: '15:00' });
    } else if (shift === 'Evening') {
      this.batchForm.patchValue({ startTime: '16:00', endTime: '19:00' });
    }

    // When editing an existing batch, NEVER overwrite the batch name!
    if (this.isEditMode) return;

    const currentName = (this.batchForm.get('name')?.value || '').trim();
    if (!currentName) {
      const className = this.getSelectedClassName() || 'Coaching';
      this.batchForm.patchValue({
        name: `${className} - ${shift} Coaching Batch`
      });
    }
  }

  initClassRange(): void {
    if (this.availableClasses.length === 0) return;
    const sorted = [...this.availableClasses];
    const rangeMatch = this.data?.name?.match(/class\s*(\d+)(?:st|nd|rd|th)?\s*(?:to|-)\s*(?:class\s*)?(\d+)(?:st|nd|rd|th)?/i);
    if (rangeMatch) {
      const fromNum = parseInt(rangeMatch[1], 10);
      const toNum = parseInt(rangeMatch[2], 10);
      const fromClass = sorted.find(c => c.name.toLowerCase().includes(`${fromNum}`));
      const toClass = sorted.find(c => c.name.toLowerCase().includes(`${toNum}`));
      this.rangeFromClassId = fromClass?.id || sorted[0]?.id || '';
      this.rangeToClassId = toClass?.id || sorted[Math.min(4, sorted.length - 1)]?.id || '';
    } else {
      this.rangeFromClassId = sorted[0]?.id || '';
      this.rangeToClassId = sorted[Math.min(4, sorted.length - 1)]?.id || '';
    }
  }

  setBatchScope(scope: 'single' | 'combined'): void {
    this.batchScope = scope;
    if (scope === 'combined') {
      this.batchForm.patchValue({ classId: null });
      this.updateCombinedBatchName();
    } else {
      if (!this.batchForm.get('classId')?.value && this.availableClasses.length > 0) {
        this.batchForm.patchValue({ classId: this.availableClasses[0].id });
      }
      this.updateSingleBatchName();
    }
  }

  onRangeFromChange(classId: string): void {
    this.rangeFromClassId = classId;
    this.updateCombinedBatchName();
  }

  onRangeToChange(classId: string): void {
    this.rangeToClassId = classId;
    this.updateCombinedBatchName();
  }

  getRangeFromClassName(): string {
    return this.availableClasses.find(c => c.id === this.rangeFromClassId)?.name || 'Class 1st';
  }

  getRangeToClassName(): string {
    return this.availableClasses.find(c => c.id === this.rangeToClassId)?.name || 'Class 5th';
  }

  getCombinedRangeLabel(): string {
    return `${this.getRangeFromClassName()} to ${this.getRangeToClassName()}`;
  }

  updateCombinedBatchName(): void {
    if (this.isEditMode) return;
    const fromName = this.getRangeFromClassName();
    const toName = this.getRangeToClassName();
    const shift = this.selectedShift;
    this.batchForm.patchValue({
      name: `${fromName} To ${toName} - ${shift} Coaching Batch`
    });
  }

  updateSingleBatchName(): void {
    if (this.isEditMode) return;
    const className = this.getSelectedClassName() || 'Class 5th';
    const shift = this.selectedShift;
    this.batchForm.patchValue({
      name: `${className} - ${shift} Coaching Batch`
    });
  }

  onClassSelectionChanged(classId: string | null): void {
    if (!this.isEditMode) {
      this.updateSingleBatchName();
    }
  }

  onSubmit(): void {
    if (this.batchForm.invalid) return;

    const formVal = this.batchForm.value;
    if (this.batchScope === 'single' && !formVal.classId) {
      this.confirmDialog.alert('Class Required', 'Please select a Target Academic Class for Single Class batch.', 'warning');
      return;
    }

    this.saving = true;
    const subjectsArray: string[] = formVal.selectedSubjects || [];

    const payload = {
      name: formVal.name,
      subject: subjectsArray.join(', '),
      academicYear: formVal.academicYear,
      standardMonthlyFee: this.data?.standardMonthlyFee ?? 0,
      branchId: formVal.branchId || null,
      roomId: formVal.roomId || null,
      classId: this.batchScope === 'single' ? (formVal.classId || null) : null,
      mentorTeacherId: formVal.mentorTeacherId || null,
      shift: formVal.shift || this.selectedShift || 'Morning',
      startTime: formVal.startTime || null,
      endTime: formVal.endTime || null
    };

    if (this.isEditMode && this.data?.id) {
      this.batchesService.updateBatch(this.data.id, payload).subscribe({
        next: (updated) => {
          this.saving = false;
          this.dialogRef.close(updated);
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Update Failed', err?.error?.message || 'Error updating batch');
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
          this.confirmDialog.alert('Creation Failed', err?.error?.message || 'Error creating batch');
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
