import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { forkJoin } from 'rxjs';
import { TeacherSelectorComponent } from './teacher-selector.component';
import { API_BASE, TeacherDto, BatchAssignmentDto, BatchDto, SubjectDto } from './teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface AssignmentSlot {
  id: string;
  batchId: string;
  selectedSubjects: string[];
  selectedDays: string[];
  timeSlotMode: 'preset' | 'custom';
  presetSlot: string;
  startTime: string;
  endTime: string;
  clashWarning: string | null;
  allowClashOverride: boolean;
}

@Component({
  selector: 'app-teacher-assignments',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSelectModule, MatTooltipModule,
    MatDialogModule, MatProgressBarModule, MatCheckboxModule, TeacherSelectorComponent
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>class</mat-icon> Batch Assignments & Timetable</h1>
      <p class="page-subtitle">Assign batches to teachers with multi-subject selection, flexible routine days, and smart time slots.</p>
    </div>
  </div>

  <app-teacher-selector [preSelectId]="preSelectId" (teacherSelected)="onTeacherSelected($event)"></app-teacher-selector>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div *ngIf="!selectedTeacher" class="no-selection">
    <mat-icon>person_search</mat-icon>
    <p>Select a teacher above to view existing batch assignments or assign new batches.</p>
  </div>

  <div *ngIf="selectedTeacher" class="teacher-view-wrapper">
    <!-- Header with Action Button & Workload Summary -->
    <div class="section-header">
      <div class="teacher-title-box">
        <h3>{{selectedTeacher.fullName}}'s Assigned Batches</h3>
        <span class="badge-count" *ngIf="assignments.length > 0">
          {{assignments.length}} {{assignments.length === 1 ? 'Batch' : 'Batches'}} Active
        </span>
      </div>
      <button mat-raised-button color="primary" class="toggle-btn" (click)="toggleForm()">
        <mat-icon>{{showForm ? 'close' : 'add'}}</mat-icon>
        {{showForm ? 'Cancel' : 'Assign New Batch'}}
      </button>
    </div>

    <!-- Dynamic Multi-Row Assignment Builder Form -->
    <div class="assign-form-container mat-elevation-z2" *ngIf="showForm">
      <div class="form-banner">
        <div class="banner-title">
          <mat-icon color="primary">tune</mat-icon>
          <div>
            <strong>Smart Batch Assignment Builder</strong>
            <p>Configure one or more batch slots and save with a single click.</p>
          </div>
        </div>
        <div class="workload-live-badge" *ngIf="totalClassesPerWeek > 0">
          <mat-icon>insights</mat-icon>
          <span>Load: <strong>{{totalClassesPerWeek}} classes / week</strong> (~{{totalHoursPerWeek}} hrs)</span>
        </div>
      </div>

      <!-- Slots List -->
      <div class="slots-list">
        <div class="slot-card" *ngFor="let slot of slots; let i = index">
          <div class="slot-card-header">
            <div class="slot-tag">
              <span class="slot-index">Slot #{{i + 1}}</span>
              <span class="slot-summary-text" *ngIf="slot.batchId">
                {{getBatchName(slot.batchId)}}
              </span>
            </div>
            <button mat-icon-button color="warn" *ngIf="slots.length > 1" (click)="removeSlot(i)" matTooltip="Remove this slot">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>

          <div class="slot-body">
            <!-- Row 1: Batch & Multi-Select Subject -->
            <div class="slot-row">
              <mat-form-field appearance="outline" class="field-batch">
                <mat-label>Select Batch *</mat-label>
                <mat-select [(ngModel)]="slot.batchId" (selectionChange)="onBatchChanged(slot)">
                  <mat-option *ngFor="let b of batches" [value]="b.id">
                    <strong>{{b.name}}</strong> <span class="opt-subject" *ngIf="b.subject">({{b.subject}})</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="field-subject">
                <mat-label>Subject(s) * (Multi-Select)</mat-label>
                <mat-select [(ngModel)]="slot.selectedSubjects" multiple (selectionChange)="checkClashes()">
                  <mat-select-trigger>
                    <span class="trigger-chip" *ngFor="let s of slot.selectedSubjects">
                      {{s}}
                    </span>
                    <span *ngIf="!slot.selectedSubjects || slot.selectedSubjects.length === 0" class="placeholder-trigger">
                      Select Subject(s)
                    </span>
                  </mat-select-trigger>
                  <mat-option *ngFor="let sub of subjects" [value]="sub.name">
                    <span class="sub-name">{{sub.name}}</span>
                    <span class="sub-code" *ngIf="sub.code">[{{sub.code}}]</span>
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <!-- Row 2: Days of Week (Quick Presets + Day Pills) -->
            <div class="slot-section">
              <div class="section-label-bar">
                <label class="section-label"><mat-icon>date_range</mat-icon> Routine Days *</label>
                <span class="days-preview" *ngIf="slot.selectedDays.length > 0">
                  Selected: <strong>{{slot.selectedDays.join(', ')}}</strong> ({{slot.selectedDays.length}} days/wk)
                </span>
                <span class="days-preview empty" *ngIf="slot.selectedDays.length === 0">
                  No days selected
                </span>
              </div>

              <!-- 1-Click Coaching Presets -->
              <div class="presets-row">
                <span class="preset-title">⚡ Quick Presets:</span>
                <button type="button" class="preset-pill" (click)="applyDayPreset(slot, 'MWF')"
                  [class.preset-active]="isPresetActive(slot, 'MWF')">
                  MWF (Mon, Wed, Fri)
                </button>
                <button type="button" class="preset-pill" (click)="applyDayPreset(slot, 'TTS')"
                  [class.preset-active]="isPresetActive(slot, 'TTS')">
                  TTS (Tue, Thu, Sat)
                </button>
                <button type="button" class="preset-pill" (click)="applyDayPreset(slot, 'DAILY')"
                  [class.preset-active]="isPresetActive(slot, 'DAILY')">
                  Daily (Mon–Sat)
                </button>
                <button type="button" class="preset-pill" (click)="applyDayPreset(slot, 'WEEKEND')"
                  [class.preset-active]="isPresetActive(slot, 'WEEKEND')">
                  Weekend (Sat, Sun)
                </button>
                <button type="button" class="preset-pill" (click)="applyDayPreset(slot, 'ALL')"
                  [class.preset-active]="isPresetActive(slot, 'ALL')">
                  All 7 Days
                </button>
                <button type="button" class="preset-pill clear-pill" (click)="clearDays(slot)" *ngIf="slot.selectedDays.length > 0">
                  Clear
                </button>
              </div>

              <!-- Interactive Day Pills -->
              <div class="day-pills-row">
                <button type="button" *ngFor="let day of allDays"
                  class="day-circle"
                  [class.day-selected]="isDaySelected(slot, day)"
                  (click)="toggleDay(slot, day)">
                  {{day}}
                </button>
              </div>
            </div>

            <!-- Row 3: Time Slot Selector (Popular Slots + Custom Start/End) -->
            <div class="slot-section">
              <div class="section-label-bar">
                <label class="section-label"><mat-icon>schedule</mat-icon> Time Slot *</label>
                <div class="mode-toggles">
                  <button type="button" class="mode-btn"
                    [class.mode-btn-active]="slot.timeSlotMode === 'preset'"
                    (click)="setTimeSlotMode(slot, 'preset')">
                    Standard Presets
                  </button>
                  <button type="button" class="mode-btn"
                    [class.mode-btn-active]="slot.timeSlotMode === 'custom'"
                    (click)="setTimeSlotMode(slot, 'custom')">
                    Custom Time
                  </button>
                </div>
              </div>

              <!-- Mode A: Common Coaching Shift Chips -->
              <div class="preset-slots-grid" *ngIf="slot.timeSlotMode === 'preset'">
                <button type="button" *ngFor="let ps of popularTimeSlots"
                  class="time-chip"
                  [class.time-chip-selected]="slot.presetSlot === ps.value"
                  (click)="selectPresetSlot(slot, ps.value)">
                  <mat-icon class="chip-icon">access_time</mat-icon>
                  <span class="chip-label">{{ps.value}}</span>
                  <span class="chip-duration">{{ps.duration}}</span>
                </button>
              </div>

              <!-- Mode B: Custom Start & End Time Picker -->
              <div class="custom-time-row" *ngIf="slot.timeSlotMode === 'custom'">
                <div class="time-input-group">
                  <label>Start Time</label>
                  <input type="time" class="time-native-input" [(ngModel)]="slot.startTime" (change)="onCustomTimeChange(slot)">
                </div>
                <span class="time-sep">to</span>
                <div class="time-input-group">
                  <label>End Time</label>
                  <input type="time" class="time-native-input" [(ngModel)]="slot.endTime" (change)="onCustomTimeChange(slot)">
                </div>
                <div class="duration-badge">
                  <mat-icon>timelapse</mat-icon>
                  <span>Duration: <strong>{{getCustomDuration(slot)}}</strong></span>
                </div>
              </div>
            </div>

            <!-- Clash Warning Alert Box -->
            <div class="clash-alert-box" *ngIf="slot.clashWarning">
              <div class="alert-content">
                <mat-icon color="warn">warning</mat-icon>
                <div>
                  <strong>Schedule Clash Detected:</strong>
                  <p>{{slot.clashWarning}}</p>
                </div>
              </div>
              <div class="clash-override-action">
                <mat-checkbox [(ngModel)]="slot.allowClashOverride" color="primary">
                  This is a <strong>Combined / Merged Batch</strong> (Assign anyway)
                </mat-checkbox>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Add Another Slot Button & Form Actions -->
      <div class="form-footer">
        <button mat-stroked-button color="primary" class="add-slot-btn" (click)="addSlot()">
          <mat-icon>add_circle_outline</mat-icon>
          + Add Another Batch Slot
        </button>

        <div class="action-buttons">
          <button mat-button (click)="showForm = false">Cancel</button>
          <button mat-raised-button color="primary" class="save-all-btn" (click)="saveAllSlots()" [disabled]="saving || !isFormValid()">
            <mat-icon>{{saving ? 'hourglass_empty' : 'save'}}</mat-icon>
            {{slots.length > 1 ? ('Save All ' + slots.length + ' Batches') : 'Assign Batch'}}
          </button>
        </div>
      </div>
    </div>

    <!-- Assigned Batches List / Grid -->
    <div class="assignments-section">
      <div class="assignments-grid" *ngIf="assignments.length > 0">
        <mat-card class="assign-card mat-elevation-z2" *ngFor="let a of assignments">
          <div class="card-status-strip"></div>
          <div class="card-content-wrap">
            <div class="assign-header">
              <div class="batch-title-row">
                <mat-icon class="batch-icon">school</mat-icon>
                <div>
                  <strong class="batch-name">{{a.batchName}}</strong>
                  <div class="subject-chips-list">
                    <span class="subj-badge" *ngFor="let sub of splitSubjects(a.subject)">
                      {{sub}}
                    </span>
                  </div>
                </div>
              </div>
              <button mat-icon-button color="warn" class="remove-btn" (click)="removeAssignment(a.id)"
                matTooltip="Remove this batch assignment">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>

            <div class="assign-details-grid">
              <div class="detail-item" *ngIf="a.daysOfWeek">
                <mat-icon>date_range</mat-icon>
                <span><strong>Days:</strong> {{a.daysOfWeek}}</span>
              </div>
              <div class="detail-item" *ngIf="a.timeSlot">
                <mat-icon>schedule</mat-icon>
                <span><strong>Time:</strong> {{a.timeSlot}}</span>
              </div>
              <div class="detail-item">
                <mat-icon>event_available</mat-icon>
                <span><strong>Assigned:</strong> {{a.assignedAt | date:'dd MMM yyyy'}}</span>
              </div>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="assignments.length === 0 && !loading && !showForm">
        <mat-icon class="empty-icon">calendar_month</mat-icon>
        <h3>No Batches Assigned Yet</h3>
        <p>{{selectedTeacher.fullName}} currently has no active batch assignments. Click "Assign New Batch" above to set up their teaching schedule.</p>
        <button mat-raised-button color="primary" (click)="showForm = true">
          <mat-icon>add</mat-icon> Assign Batch
        </button>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    .page-container { display:flex; flex-direction:column; gap:20px; }
    .page-header { display:flex; justify-content:space-between; align-items:center; }
    .page-title { font-size:1.5rem; font-weight:700; margin:0; color:#1976d2; display:flex; align-items:center; gap:8px;
      mat-icon{font-size:1.6rem;width:1.6rem;height:1.6rem;} }
    .page-subtitle { color:#64748b; margin:4px 0 0; font-size:.9rem; }

    .no-selection { display:flex; flex-direction:column; align-items:center; padding:60px 20px; color:#94a3b8; background:#f8fafc; border-radius:12px; border:2px dashed #cbd5e1;
      mat-icon{font-size:48px;width:48px;height:48px;margin-bottom:12px;color:#94a3b8;} p{margin:0;font-size:1rem;font-weight:500;} }

    .teacher-view-wrapper { display:flex; flex-direction:column; gap:16px; }

    .section-header { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; }
    .teacher-title-box { display:flex; align-items:center; gap:12px;
      h3 { margin:0; font-weight:700; font-size:1.15rem; color:#0f172a; } }
    .badge-count { background:#e0f2fe; color:#0284c7; padding:4px 10px; border-radius:20px; font-size:.78rem; font-weight:700; }
    .toggle-btn { border-radius:8px; font-weight:600; }

    /* Assign Form Container */
    .assign-form-container { background:#ffffff; border-radius:14px; border:1px solid #e2e8f0; padding:20px; display:flex; flex-direction:column; gap:20px; box-shadow:0 4px 20px -2px rgba(0,0,0,0.06); }
    .form-banner { display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:14px; flex-wrap:wrap; gap:12px; }
    .banner-title { display:flex; align-items:center; gap:12px;
      mat-icon{font-size:26px;width:26px;height:26px;}
      strong{font-size:1.05rem;color:#1e293b;display:block;}
      p{margin:2px 0 0;font-size:.84rem;color:#64748b;} }
    .workload-live-badge { display:flex; align-items:center; gap:6px; background:#f0fdf4; color:#166534; padding:6px 14px; border-radius:20px; font-size:.82rem; border:1px solid #bbf7d0;
      mat-icon{font-size:18px;width:18px;height:18px;color:#16a34a;} }

    /* Slots List */
    .slots-list { display:flex; flex-direction:column; gap:16px; }
    .slot-card { background:#f8fafc; border:1.5px solid #e2e8f0; border-radius:12px; padding:16px; transition:border-color .2s; }
    .slot-card:hover { border-color:#cbd5e1; }
    .slot-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
    .slot-tag { display:flex; align-items:center; gap:10px; }
    .slot-index { background:#1e293b; color:#fff; font-size:.75rem; font-weight:700; padding:3px 10px; border-radius:6px; letter-spacing:.5px; }
    .slot-summary-text { font-size:.92rem; font-weight:600; color:#334155; }

    .slot-body { display:flex; flex-direction:column; gap:16px; }
    .slot-row { display:flex; flex-wrap:wrap; gap:14px; }
    .field-batch { flex:1.2; min-width:260px; }
    .field-subject { flex:1.5; min-width:260px; }
    .opt-subject { color:#64748b; font-size:.85rem; margin-left:6px; }
    .trigger-chip { background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:.78rem; font-weight:600; margin-right:4px; display:inline-block; }
    .placeholder-trigger { color:#94a3b8; font-size:.9rem; }
    .sub-name { font-weight:600; }
    .sub-code { color:#64748b; font-size:.8rem; margin-left:6px; }

    /* Slot Section Styling */
    .slot-section { display:flex; flex-direction:column; gap:10px; background:#fff; padding:14px; border-radius:10px; border:1px solid #edf2f7; }
    .section-label-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
    .section-label { font-size:.86rem; font-weight:700; color:#334155; display:flex; align-items:center; gap:6px;
      mat-icon{font-size:18px;width:18px;height:18px;color:#64748b;} }
    .days-preview { font-size:.82rem; color:#475569; strong{color:#0f172a;} }
    .days-preview.empty { color:#94a3b8; font-style:italic; }

    /* Presets Row */
    .presets-row { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
    .preset-title { font-size:.78rem; font-weight:700; color:#64748b; margin-right:4px; }
    .preset-pill { border:1px solid #cbd5e1; background:#f8fafc; color:#334155; font-size:.78rem; font-weight:600; padding:4px 10px; border-radius:14px; cursor:pointer; transition:all .15s; }
    .preset-pill:hover { background:#f1f5f9; border-color:#94a3b8; }
    .preset-pill.preset-active { background:#e0f2fe; border-color:#0284c7; color:#0369a1; font-weight:700; }
    .clear-pill { background:transparent; border-color:#fca5a5; color:#dc2626; }
    .clear-pill:hover { background:#fee2e2; }

    /* Day Circle Pills */
    .day-pills-row { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
    .day-circle { width:42px; height:36px; border-radius:8px; border:1.5px solid #cbd5e1; background:#fff; color:#475569; font-size:.82rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }
    .day-circle:hover { border-color:#0284c7; color:#0284c7; }
    .day-circle.day-selected { background:#1976d2; border-color:#1976d2; color:#fff; box-shadow:0 2px 6px rgba(25,118,210,0.3); }

    /* Time Slot Mode Toggles */
    .mode-toggles { display:flex; gap:4px; background:#f1f5f9; padding:2px; border-radius:8px; }
    .mode-btn { border:none; background:transparent; font-size:.76rem; font-weight:600; color:#64748b; padding:4px 10px; border-radius:6px; cursor:pointer; transition:all .15s; }
    .mode-btn-active { background:#fff; color:#0f172a; box-shadow:0 1px 3px rgba(0,0,0,0.1); }

    /* Preset Slots Grid */
    .preset-slots-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:8px; }
    .time-chip { display:flex; align-items:center; gap:6px; padding:7px 10px; border-radius:8px; border:1px solid #e2e8f0; background:#f8fafc; color:#334155; cursor:pointer; font-size:.8rem; font-weight:600; text-align:left; transition:all .15s; }
    .time-chip:hover { border-color:#94a3b8; background:#f1f5f9; }
    .time-chip.time-chip-selected { background:#eef2ff; border-color:#6366f1; color:#4338ca; box-shadow:0 2px 6px rgba(99,102,241,0.2); }
    .chip-icon { font-size:16px; width:16px; height:16px; color:#64748b; }
    .time-chip-selected .chip-icon { color:#6366f1; }
    .chip-label { flex:1; white-space:nowrap; }
    .chip-duration { font-size:.7rem; color:#64748b; background:#fff; padding:1px 5px; border-radius:4px; }

    /* Custom Time Row */
    .custom-time-row { display:flex; align-items:center; flex-wrap:wrap; gap:12px; }
    .time-input-group { display:flex; flex-direction:column; gap:4px;
      label{font-size:.75rem;font-weight:700;color:#64748b;} }
    .time-native-input { border:1.5px solid #cbd5e1; border-radius:8px; padding:6px 10px; font-size:.9rem; font-weight:600; color:#1e293b; background:#fff; }
    .time-native-input:focus { outline:none; border-color:#1976d2; }
    .time-sep { font-weight:700; color:#94a3b8; font-size:.85rem; margin-top:14px; }
    .duration-badge { display:flex; align-items:center; gap:6px; background:#f0fdf4; color:#166534; padding:6px 12px; border-radius:8px; font-size:.82rem; border:1px solid #bbf7d0; margin-top:14px;
      mat-icon{font-size:16px;width:16px;height:16px;color:#16a34a;} }

    /* Clash Alert Box */
    .clash-alert-box { background:#fffbeb; border:1.5px solid #fcd34d; border-radius:10px; padding:12px 16px; display:flex; flex-direction:column; gap:8px; }
    .alert-content { display:flex; align-items:flex-start; gap:10px;
      mat-icon{font-size:22px;width:22px;height:22px;color:#d97706;}
      strong{color:#b45309;font-size:.88rem;display:block;}
      p{margin:2px 0 0;font-size:.82rem;color:#92400e;} }
    .clash-override-action { border-top:1px solid #fef3c7; padding-top:6px; font-size:.84rem; }

    /* Form Footer */
    .form-footer { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; padding-top:10px; border-top:1px solid #f1f5f9; }
    .add-slot-btn { font-weight:600; border-radius:8px; }
    .action-buttons { display:flex; align-items:center; gap:10px; margin-left:auto; }
    .save-all-btn { font-weight:700; border-radius:8px; padding:0 20px; }

    /* Assigned Batches Grid */
    .assignments-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px; }
    .assign-card { border-radius:12px; overflow:hidden; border:1px solid #e2e8f0; background:#fff; position:relative; display:flex; flex-direction:column; transition:transform .2s, box-shadow .2s; }
    .assign-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08); }
    .card-status-strip { height:5px; background:linear-gradient(90deg, #1976d2, #6366f1); }
    .card-content-wrap { padding:16px; display:flex; flex-direction:column; gap:12px; }
    .assign-header { display:flex; justify-content:space-between; align-items:flex-start; }
    .batch-title-row { display:flex; align-items:flex-start; gap:10px;
      .batch-icon{font-size:24px;width:24px;height:24px;color:#1976d2;margin-top:2px;} }
    .batch-name { font-size:1.02rem; color:#0f172a; display:block; line-height:1.3; }
    .subject-chips-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
    .subj-badge { background:#e0f2fe; color:#0369a1; font-size:.74rem; font-weight:700; padding:2px 8px; border-radius:6px; }
    .remove-btn { margin-top:-4px; margin-right:-4px; }

    .assign-details-grid { display:flex; flex-direction:column; gap:6px; padding-top:8px; border-top:1px dashed #f1f5f9; }
    .detail-item { display:flex; align-items:center; gap:8px; font-size:.84rem; color:#475569;
      mat-icon{font-size:16px;width:16px;height:16px;color:#94a3b8;} strong{color:#334155;} }

    /* Empty State */
    .empty-state { display:flex; flex-direction:column; align-items:center; text-align:center; padding:50px 20px; color:#64748b; background:#f8fafc; border-radius:14px; border:2px dashed #cbd5e1;
      .empty-icon{font-size:56px;width:56px;height:56px;color:#cbd5e1;margin-bottom:12px;}
      h3{margin:0 0 6px;color:#1e293b;font-size:1.15rem;font-weight:700;}
      p{margin:0 0 20px;font-size:.9rem;max-width:480px;line-height:1.5;} }
  `]
})
export class TeacherAssignmentsComponent implements OnInit {
  private api = API_BASE;
  selectedTeacher: TeacherDto | null = null;
  preSelectId: string | null = null;
  assignments: BatchAssignmentDto[] = [];
  batches: BatchDto[] = [];
  subjects: SubjectDto[] = [];

  loading = false;
  saving = false;
  showForm = false;

  readonly allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  readonly popularTimeSlots = [
    { value: '07:00 AM - 08:30 AM', duration: '1.5 hrs', start: '07:00', end: '08:30' },
    { value: '08:00 AM - 09:30 AM', duration: '1.5 hrs', start: '08:00', end: '09:30' },
    { value: '09:30 AM - 11:00 AM', duration: '1.5 hrs', start: '09:30', end: '11:00' },
    { value: '11:00 AM - 12:30 PM', duration: '1.5 hrs', start: '11:00', end: '12:30' },
    { value: '03:00 PM - 04:30 PM', duration: '1.5 hrs', start: '15:00', end: '16:30' },
    { value: '04:00 PM - 05:30 PM', duration: '1.5 hrs', start: '16:00', end: '17:30' },
    { value: '05:30 PM - 07:00 PM', duration: '1.5 hrs', start: '17:30', end: '19:00' },
    { value: '07:00 PM - 08:30 PM', duration: '1.5 hrs', start: '19:00', end: '20:30' }
  ];

  slots: AssignmentSlot[] = [];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => { if (p['teacherId']) this.preSelectId = p['teacherId']; });
    this.loadBatches();
    this.loadSubjects();
    this.initSlots();
  }

  loadBatches() {
    this.http.get<BatchDto[]>(`${this.api}/batches`).subscribe({
      next: b => this.batches = b,
      error: () => {}
    });
  }

  loadSubjects() {
    this.http.get<SubjectDto[]>(`${this.api}/Subjects?activeOnly=true`).subscribe({
      next: s => {
        if (s && s.length > 0) {
          this.subjects = s;
        } else {
          this.fallbackSubjects();
        }
      },
      error: () => this.fallbackSubjects()
    });
  }

  private fallbackSubjects() {
    // If subjects API is empty or offline, extract unique subjects from batches
    const extracted = Array.from(new Set(this.batches.map(b => b.subject).filter(Boolean)));
    if (extracted.length > 0) {
      this.subjects = extracted.map(name => ({ id: name, name, isActive: true }));
    }
  }

  onTeacherSelected(t: TeacherDto) {
    this.selectedTeacher = t;
    this.loadAssignments();
  }

  loadAssignments() {
    if (!this.selectedTeacher) return;
    this.loading = true;
    this.http.get<BatchAssignmentDto[]>(`${this.api}/teachers/${this.selectedTeacher.id}/batch-assignments`).subscribe({
      next: r => {
        this.assignments = r;
        this.loading = false;
        this.checkClashes();
      },
      error: () => this.loading = false
    });
  }

  toggleForm() {
    this.showForm = !this.showForm;
    if (this.showForm && this.slots.length === 0) {
      this.initSlots();
    }
  }

  initSlots() {
    this.slots = [this.createNewSlot()];
  }

  createNewSlot(): AssignmentSlot {
    return {
      id: Math.random().toString(36).substring(2, 9),
      batchId: '',
      selectedSubjects: [],
      selectedDays: ['Mon', 'Wed', 'Fri'],
      timeSlotMode: 'preset',
      presetSlot: '08:00 AM - 09:30 AM',
      startTime: '08:00',
      endTime: '09:30',
      clashWarning: null,
      allowClashOverride: false
    };
  }

  addSlot() {
    this.slots.push(this.createNewSlot());
    this.checkClashes();
  }

  removeSlot(index: number) {
    if (this.slots.length > 1) {
      this.slots.splice(index, 1);
      this.checkClashes();
    }
  }

  getBatchName(batchId: string): string {
    const b = this.batches.find(x => x.id === batchId);
    return b ? b.name : '';
  }

  onBatchChanged(slot: AssignmentSlot) {
    const batch = this.batches.find(b => b.id === slot.batchId);
    if (batch && batch.subject) {
      // If subject not selected yet, auto-select batch subject
      if (!slot.selectedSubjects || slot.selectedSubjects.length === 0) {
        const found = this.subjects.find(s => s.name.toLowerCase() === batch.subject.toLowerCase());
        slot.selectedSubjects = [found ? found.name : batch.subject];
      }
    }
    this.checkClashes();
  }

  // Days Selection Helpers
  applyDayPreset(slot: AssignmentSlot, preset: 'MWF' | 'TTS' | 'DAILY' | 'WEEKEND' | 'ALL') {
    switch (preset) {
      case 'MWF':
        slot.selectedDays = ['Mon', 'Wed', 'Fri'];
        break;
      case 'TTS':
        slot.selectedDays = ['Tue', 'Thu', 'Sat'];
        break;
      case 'DAILY':
        slot.selectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        break;
      case 'WEEKEND':
        slot.selectedDays = ['Sat', 'Sun'];
        break;
      case 'ALL':
        slot.selectedDays = [...this.allDays];
        break;
    }
    this.checkClashes();
  }

  isPresetActive(slot: AssignmentSlot, preset: 'MWF' | 'TTS' | 'DAILY' | 'WEEKEND' | 'ALL'): boolean {
    const targetMap = {
      MWF: ['Mon', 'Wed', 'Fri'],
      TTS: ['Tue', 'Thu', 'Sat'],
      DAILY: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      WEEKEND: ['Sat', 'Sun'],
      ALL: [...this.allDays]
    };
    const target = targetMap[preset];
    if (slot.selectedDays.length !== target.length) return false;
    return target.every(d => slot.selectedDays.includes(d));
  }

  toggleDay(slot: AssignmentSlot, day: string) {
    const idx = slot.selectedDays.indexOf(day);
    if (idx > -1) {
      slot.selectedDays.splice(idx, 1);
    } else {
      slot.selectedDays.push(day);
      // Keep sorted by week order
      slot.selectedDays.sort((a, b) => this.allDays.indexOf(a) - this.allDays.indexOf(b));
    }
    this.checkClashes();
  }

  isDaySelected(slot: AssignmentSlot, day: string): boolean {
    return slot.selectedDays.includes(day);
  }

  clearDays(slot: AssignmentSlot) {
    slot.selectedDays = [];
    this.checkClashes();
  }

  // Time Slot Helpers
  setTimeSlotMode(slot: AssignmentSlot, mode: 'preset' | 'custom') {
    slot.timeSlotMode = mode;
    this.checkClashes();
  }

  selectPresetSlot(slot: AssignmentSlot, presetValue: string) {
    slot.presetSlot = presetValue;
    this.checkClashes();
  }

  onCustomTimeChange(slot: AssignmentSlot) {
    this.checkClashes();
  }

  getCustomDuration(slot: AssignmentSlot): string {
    if (!slot.startTime || !slot.endTime) return '0 mins';
    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff <= 0) return 'Invalid time range';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (hours > 0 && mins > 0) return `${hours} hr ${mins} mins`;
    if (hours > 0) return `${hours} hr`;
    return `${mins} mins`;
  }

  getFormattedTimeSlot(slot: AssignmentSlot): string {
    if (slot.timeSlotMode === 'preset') {
      return slot.presetSlot;
    }
    // Custom formatted
    const formatTime = (t: string) => {
      if (!t) return '';
      const [h, m] = t.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 || 12;
      return `${hr < 10 ? '0' + hr : hr}:${m < 10 ? '0' + m : m} ${ampm}`;
    };
    return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
  }

  // Workload KPIs
  get totalClassesPerWeek(): number {
    return this.slots.reduce((sum, s) => s.batchId ? sum + s.selectedDays.length : sum, 0);
  }

  get totalHoursPerWeek(): string {
    let totalMinutes = 0;
    for (const slot of this.slots) {
      if (!slot.batchId || slot.selectedDays.length === 0) continue;
      let slotDurationMin = 90; // default 1.5 hr
      if (slot.timeSlotMode === 'custom' && slot.startTime && slot.endTime) {
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff > 0) slotDurationMin = diff;
      }
      totalMinutes += (slotDurationMin * slot.selectedDays.length);
    }
    return (totalMinutes / 60).toFixed(1);
  }

  // Schedule Clash Detection
  checkClashes() {
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.clashWarning = null;
      if (!slot.batchId || slot.selectedDays.length === 0) continue;

      const currentSlotTime = this.getFormattedTimeSlot(slot);

      // 1. Check against existing saved assignments
      for (const existing of this.assignments) {
        if (!existing.daysOfWeek || !existing.timeSlot) continue;
        const existingDays = existing.daysOfWeek.split(',').map(d => d.trim());
        const hasDayOverlap = slot.selectedDays.some(d => existingDays.includes(d));

        if (hasDayOverlap && existing.timeSlot.trim().toLowerCase() === currentSlotTime.trim().toLowerCase()) {
          slot.clashWarning = `Overlaps with previously assigned batch "${existing.batchName}" on (${slot.selectedDays.filter(d => existingDays.includes(d)).join(', ')}) at (${existing.timeSlot}).`;
          break;
        }
      }

      // 2. Check against other slots in the current form
      if (!slot.clashWarning) {
        for (let j = 0; j < this.slots.length; j++) {
          if (i === j) continue;
          const other = this.slots[j];
          if (!other.batchId || other.selectedDays.length === 0) continue;

          const otherSlotTime = this.getFormattedTimeSlot(other);
          const hasDayOverlap = slot.selectedDays.some(d => other.selectedDays.includes(d));

          if (hasDayOverlap && currentSlotTime.trim().toLowerCase() === otherSlotTime.trim().toLowerCase()) {
            slot.clashWarning = `Overlaps with Slot #${j + 1} ("${this.getBatchName(other.batchId)}") at the same time (${currentSlotTime}).`;
            break;
          }
        }
      }
    }
  }

  isFormValid(): boolean {
    if (!this.selectedTeacher || this.slots.length === 0) return false;
    for (const slot of this.slots) {
      if (!slot.batchId) return false;
      if (!slot.selectedSubjects || slot.selectedSubjects.length === 0) return false;
      if (!slot.selectedDays || slot.selectedDays.length === 0) return false;
      if (slot.timeSlotMode === 'custom' && (!slot.startTime || !slot.endTime)) return false;
      if (slot.clashWarning && !slot.allowClashOverride) return false;
    }
    return true;
  }

  // Save All Slots
  saveAllSlots() {
    if (!this.selectedTeacher || !this.isFormValid()) return;

    this.saving = true;
    const payloadSlots = this.slots.map(s => ({
      batchId: s.batchId,
      subject: s.selectedSubjects.join(', '),
      daysOfWeek: s.selectedDays.join(','),
      timeSlot: this.getFormattedTimeSlot(s)
    }));

    // Try bulk endpoint first
    this.http.post<BatchAssignmentDto[]>(`${this.api}/teachers/batch-assignments/bulk`, {
      teacherId: this.selectedTeacher.id,
      slots: payloadSlots
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.initSlots();
        this.loadAssignments();
        this.confirmDialog.alert(
          'Batch Assignment Saved',
          `${payloadSlots.length} batch assignment(s) saved successfully for ${this.selectedTeacher?.fullName || 'the teacher'}!`,
          'success'
        );
      },
      error: () => {
        // Fallback: sequential / forkJoin individual saves if backend process not yet restarted
        const reqs = payloadSlots.map(slot =>
          this.http.post<BatchAssignmentDto>(`${this.api}/teachers/batch-assignments`, {
            teacherId: this.selectedTeacher!.id,
            ...slot
          })
        );
        forkJoin(reqs).subscribe({
          next: () => {
            this.saving = false;
            this.showForm = false;
            this.initSlots();
            this.loadAssignments();
            this.confirmDialog.alert(
              'Batch Assignment Saved',
              `${payloadSlots.length} batch assignment(s) saved successfully for ${this.selectedTeacher?.fullName || 'the teacher'}!`,
              'success'
            );
          },
          error: err => {
            this.saving = false;
            this.confirmDialog.alert(
              'Assignment Failed',
              err?.error?.message || 'Error assigning batches. Please try again.',
              'danger'
            );
          }
        });
      }
    });
  }

  removeAssignment(id: string) {
    const assignment = this.assignments.find(a => a.id === id);
    const targetName = assignment ? `"${assignment.batchName}"` : 'this batch';

    this.confirmDialog.danger(
      'Remove Batch Assignment',
      `Are you sure you want to remove ${targetName} assignment from ${this.selectedTeacher?.fullName || 'this teacher'}? This action cannot be undone.`,
      'Remove Assignment'
    ).subscribe(confirmed => {
      if (confirmed) {
        this.http.delete(`${this.api}/teachers/batch-assignments/${id}`).subscribe({
          next: () => {
            this.loadAssignments();
            this.confirmDialog.alert('Assignment Removed', 'Batch assignment removed successfully.', 'success');
          },
          error: err => {
            this.confirmDialog.alert('Remove Failed', err?.error?.message || 'Failed to remove assignment.', 'danger');
          }
        });
      }
    });
  }

  splitSubjects(sub: string): string[] {
    if (!sub) return [];
    return sub.split(',').map(s => s.trim()).filter(Boolean);
  }
}
