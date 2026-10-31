import { Component, Inject, OnInit, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SchoolService } from '../../core/services/school.service';
import { TeacherDto } from '../teachers/teacher.models';

export interface QuickClassTeacherDialogData {
  sectionId: string;
  sectionName: string;
  className: string;
  currentClassTeacherId?: string | null;
  currentClassTeacherName?: string | null;
  teachers: TeacherDto[];
  classes?: any[];
}

export interface SectionAssignmentRecord {
  className: string;
  sectionName: string;
  sectionId: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-quick-class-teacher-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule
],
  template: `
    <div class="dialog-container">
      <!-- Strict Light Blue Header matching AGENTS.md Rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>supervisor_account</mat-icon>
          </div>
          <div class="header-text-block">
            <h2 class="dialog-title">Assign Class Teacher</h2>
            <p class="dialog-subtitle">
              Section Incharge for <strong>{{ data.className }} - {{ data.sectionName }}</strong>
            </p>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="onClose()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    
      <div class="dialog-body">
        <!-- Current Status Banner -->
        <div class="current-status-banner" [class.assigned]="data.currentClassTeacherId" [class.unassigned]="!data.currentClassTeacherId">
          <div class="banner-left">
            <mat-icon class="status-icon">{{ data.currentClassTeacherId ? 'verified' : 'info' }}</mat-icon>
            <div class="status-text">
              <span class="status-label">Current Class Teacher:</span>
              <strong class="status-val">{{ data.currentClassTeacherName || 'No Teacher Assigned Yet' }}</strong>
            </div>
          </div>
          @if (data.currentClassTeacherId) {
            <button
              type="button"
              class="banner-remove-btn"
              (click)="unassignTeacher()"
              [disabled]="saving"
              matTooltip="Remove current Class Teacher"
              >
              <mat-icon>person_remove</mat-icon>
              <span>Remove Teacher</span>
            </button>
          }
        </div>
    
        <!-- Conflict Alert if teacher is assigned elsewhere -->
        @if (conflictNotice || getSelectedTeacherOtherAssignmentText()) {
          <div class="conflict-alert">
            <div class="conflict-icon">
              <mat-icon>warning_amber</mat-icon>
            </div>
            <div class="conflict-content">
              <strong>Reassignment Notice</strong>
              @if (conflictNotice) {
                <p>{{ conflictNotice }}</p>
              }
              @if (!conflictNotice && getSelectedTeacherOtherAssignmentText(); as otherAssigned) {
                <p>
                  <strong>{{ selectedTeacher?.fullName }}</strong> is currently assigned as Class Teacher for <strong>{{ otherAssigned }}</strong>.
                </p>
              }
              <small>Saving this assignment will transfer this faculty to <strong>{{ data.className }} - {{ data.sectionName }}</strong>.</small>
            </div>
          </div>
        }
    
        <!-- Teacher Search & Selection -->
        <div class="form-section">
          <!-- Mat Select Dropdown with Sticky In-Dropdown Search Header -->
          <mat-form-field appearance="outline" class="full-width faculty-field">
            <mat-label>Select Faculty (कक्षा अध्यापक)</mat-label>
            <mat-select
              [(ngModel)]="selectedTeacherId"
              (selectionChange)="onTeacherChange()"
              placeholder="Choose teacher..."
              panelClass="faculty-select-panel"
              (openedChange)="onSelectOpened($event)"
              >
              <mat-select-trigger>
                @if (selectedTeacher) {
                  <div class="selected-trigger-box">
                    <div class="trigger-top">
                      <strong>{{ selectedTeacher.fullName }}</strong>
                      <span class="trigger-code">({{ selectedTeacher.employeeCode }})</span>
                      @if (isCurrentSectionTeacher(selectedTeacher.id)) {
                        <span class="assign-badge-mini current">Assigned Here</span>
                      }
                      @if (getOtherAssignedText(selectedTeacher.id); as otherText) {
                        <span class="assign-badge-mini conflict">{{ otherText }}</span>
                      }
                      @if (!isAssignedAnywhere(selectedTeacher.id)) {
                        <span class="assign-badge-mini available">Available</span>
                      }
                    </div>
                    @if (selectedTeacher.specialization) {
                      <span class="trigger-spec">&bull; {{ selectedTeacher.specialization }}</span>
                    }
                  </div>
                }
                @if (!selectedTeacher) {
                  <span class="placeholder-text">
                    {{ selectedTeacherId === null ? '-- None (Unassigned) --' : 'Choose teacher...' }}
                  </span>
                }
              </mat-select-trigger>
    
              <!-- Sticky In-Dropdown Search Header -->
              <div class="dropdown-search-wrapper" (keydown)="$event.stopPropagation()" (click)="$event.stopPropagation()">
                <mat-icon class="dd-search-icon">search</mat-icon>
                <input
                  #dropdownSearchInput
                  type="text"
                  class="dd-search-input"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="filterTeachers()"
                  placeholder="Type name, code, subject, or assigned class..."
                  />
                  @if (searchQuery) {
                    <button type="button" class="dd-clear-btn" (click)="clearSearch()">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
    
                <mat-option [value]="null">
                  <span class="unassigned-opt">-- None (Unassigned) --</span>
                </mat-option>
    
                @for (t of filteredTeachers; track t) {
                  <mat-option [value]="t.id">
                    <div class="teacher-opt-card">
                      <!-- Row 1: Identity & Class Assignment Status Badge -->
                      <div class="opt-row-top">
                        <div class="opt-identity">
                          <strong class="opt-name">{{ t.fullName }}</strong>
                          <span class="opt-code">({{ t.employeeCode }})</span>
                        </div>
                        <!-- Clear Visual Badge: Shows Assigned Class or Available -->
                        @if (isCurrentSectionTeacher(t.id)) {
                          <span class="assign-badge current" matTooltip="Already Class Teacher of this section">
                            <mat-icon class="b-icon">check_circle</mat-icon> Assigned Here
                          </span>
                        }
                        @if (getOtherAssignedText(t.id); as otherText) {
                          <span class="assign-badge conflict" [matTooltip]="'Already Class Teacher of ' + otherText">
                            <mat-icon class="b-icon">school</mat-icon> Class Teacher: {{ otherText }}
                          </span>
                        }
                        @if (!isAssignedAnywhere(t.id)) {
                          <span class="assign-badge available" matTooltip="Available - Not assigned as Class Teacher in any class">
                            <mat-icon class="b-icon">verified_user</mat-icon> Available
                          </span>
                        }
                      </div>
                      <!-- Row 2: Subject Specialization & Phone -->
                      <div class="opt-row-bottom">
                        @if (t.specialization) {
                          <span class="opt-spec">
                            <mat-icon class="sub-icon">menu_book</mat-icon> {{ t.specialization }}
                          </span>
                        }
                        @if (!t.specialization) {
                          <span class="opt-spec-placeholder">&bull; General Faculty</span>
                        }
                        @if (t.phoneNumber) {
                          <span class="opt-phone">📞 {{ t.phoneNumber }}</span>
                        }
                      </div>
                    </div>
                  </mat-option>
                }
    
                @if (filteredTeachers.length === 0) {
                  <div class="dd-no-results">
                    <mat-icon>person_search</mat-icon>
                    <span>No faculty found matching "<strong>{{ searchQuery }}</strong>"</span>
                  </div>
                }
              </mat-select>
              @if (searchQuery) {
                <mat-hint>
                  Showing {{ filteredTeachers.length }} of {{ availableTeachers.length }} faculty members
                </mat-hint>
              }
            </mat-form-field>
          </div>
    
          <!-- Selected Teacher Card Preview -->
          @if (selectedTeacher) {
            <div class="teacher-preview-card">
              <div class="preview-avatar">
                <mat-icon>account_circle</mat-icon>
              </div>
              <div class="preview-details">
                <div class="preview-name-row">
                  <span class="preview-name">{{ selectedTeacher.fullName }}</span>
                  @if (isCurrentSectionTeacher(selectedTeacher.id)) {
                    <span class="assign-badge-mini current">Assigned Here</span>
                  }
                  @if (getOtherAssignedText(selectedTeacher.id); as ot) {
                    <span class="assign-badge-mini conflict">Class Teacher: {{ ot }}</span>
                  }
                  @if (!isAssignedAnywhere(selectedTeacher.id)) {
                    <span class="assign-badge-mini available">Available</span>
                  }
                </div>
                <div class="preview-sub">
                  <span>Code: <strong>{{ selectedTeacher.employeeCode }}</strong></span>
                  @if (selectedTeacher.phoneNumber) {
                    <span>&bull; 📞 {{ selectedTeacher.phoneNumber }}</span>
                  }
                  @if (selectedTeacher.specialization) {
                    <span>&bull; {{ selectedTeacher.specialization }}</span>
                  }
                </div>
              </div>
            </div>
          }
    
          <div class="role-help-note">
            <mat-icon>lightbulb</mat-icon>
            <span>The Class Teacher is responsible for student attendance, report card signatures, class discipline, and direct parent communications for this section.</span>
          </div>
        </div>
    
        <!-- Dialog Actions -->
        <div class="dialog-actions">
          @if (data.currentClassTeacherId) {
            <button mat-flat-button color="warn" class="btn-unassign" (click)="unassignTeacher()" [disabled]="saving">
              <mat-icon>person_remove</mat-icon>
              <span>Remove Class Teacher</span>
            </button>
          }
          <span class="actions-spacer"></span>
          <div class="primary-actions">
            <button mat-button class="btn-cancel" (click)="onClose()" [disabled]="saving">Cancel</button>
            @if (!conflictNotice && !getSelectedTeacherOtherAssignmentText()) {
              <button mat-flat-button color="primary" class="btn-save" (click)="saveAssignment(false)" [disabled]="saving || !hasChanged">
                <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
                <span>Save Assignment</span>
              </button>
            }
            @if (conflictNotice || getSelectedTeacherOtherAssignmentText()) {
              <button mat-flat-button color="accent" class="btn-confirm-transfer" (click)="saveAssignment(true)" [disabled]="saving || !hasChanged">
                <mat-icon>swap_horiz</mat-icon>
                <span>Confirm & Transfer</span>
              </button>
            }
          </div>
        </div>
      </div>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .dialog-container {
      width: 100%;
      max-width: 540px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      max-height: 88vh;
      overflow: hidden;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }

    .header-icon-box {
      width: 40px;
      height: 40px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .header-text-block {
      min-width: 0;
      flex: 1;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.08rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dialog-subtitle {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: #3b82f6;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      width: 32px !important;
      height: 32px !important;
      padding: 0 !important;
      min-width: 32px !important;
      color: #64748b !important;
      background: rgba(148, 163, 184, 0.15) !important;
      border-radius: 8px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      flex-shrink: 0;
      transition: all 0.2s ease;

      mat-icon {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
      }

      &:hover {
        color: #0f172a !important;
        background: rgba(148, 163, 184, 0.3) !important;
      }

      ::ng-deep .mat-mdc-button-touch-target {
        display: none !important;
      }
    }

    /* Dialog Body */
    .dialog-body {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      overflow-y: auto;
    }

    .current-status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
    }

    .banner-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      flex: 1;
    }

    .current-status-banner.assigned {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
    }

    .current-status-banner.unassigned {
      background: #fefce8;
      border: 1px solid #fef08a;
      color: #854d0e;
    }

    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .status-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .banner-remove-btn {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      font-size: 0.78rem;
      font-weight: 600;
      color: #b91c1c;
      background: #ffffff;
      border: 1px solid #f87171;
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;

      mat-icon {
        font-size: 15px;
        width: 15px;
        height: 15px;
        line-height: 15px;
      }

      &:hover:not([disabled]) {
        background: #fee2e2;
        border-color: #dc2626;
        color: #991b1b;
        box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);
      }

      &[disabled] {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    @media (max-width: 420px) {
      .current-status-banner {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .banner-remove-btn {
        width: 100%;
        justify-content: center;
        padding: 6px 10px;
      }
    }

    .status-label {
      font-size: 0.76rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.85;
    }

    .status-val {
      font-size: 0.95rem;
    }

    .conflict-alert {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      gap: 12px;
      color: #92400e;
      font-size: 0.85rem;
    }

    .conflict-icon mat-icon {
      color: #d97706;
    }

    .conflict-content p {
      margin: 4px 0 6px;
      line-height: 1.35;
    }

    .full-width {
      width: 100%;
    }

    /* Live Search Bar */
    .search-filter-box {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:focus-within {
        border-color: #2563eb;
        background: #ffffff;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
      }

      .search-icon {
        color: #2563eb;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .search-input {
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        font-size: 0.88rem;
        color: #0f172a;

        &::placeholder {
          color: #94a3b8;
        }
      }

      .clear-btn {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        color: #94a3b8;
        display: flex;
        align-items: center;
        &:hover { color: #334155; }
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }

      .results-badge {
        font-size: 0.75rem;
        font-weight: 600;
        background: #eff6ff;
        color: #1e40af;
        padding: 2px 8px;
        border-radius: 12px;
      }
    }

    .quick-chips-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 8px;

      .quick-chip-lbl {
        font-size: 0.75rem;
        color: #64748b;
        font-weight: 500;
      }

      .quick-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 3px 10px;
        font-size: 0.78rem;
        color: #334155;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #e0f2fe;
          border-color: #93c5fd;
          color: #1d4ed8;
        }

        &.active {
          background: #2563eb;
          border-color: #1d4ed8;
          color: #ffffff;
        }

        .chip-assigned {
          color: #d97706;
          font-weight: 600;
          font-size: 0.72rem;
        }

        .chip-spec {
          opacity: 0.75;
          font-size: 0.72rem;
        }
      }
    }

    .selected-trigger-box {
      display: flex;
      flex-direction: column;
      gap: 2px;
      line-height: 1.25;

      .trigger-top {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #0f172a;

        strong {
          color: #1e40af;
        }

        .trigger-code {
          color: #64748b;
          font-size: 0.8rem;
        }
      }

      .trigger-spec {
        color: #475569;
        font-size: 0.78rem;
      }
    }

    .unassigned-opt {
      color: #64748b;
      font-style: italic;
    }

    .teacher-preview-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .preview-avatar mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #3b82f6;
    }

    .preview-name-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .preview-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.95rem;
    }

    .preview-sub {
      font-size: 0.8rem;
      color: #64748b;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 2px;
    }

    .role-help-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.8rem;
      color: #1e40af;
      line-height: 1.35;
    }

    .role-help-note mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .dialog-actions {
      padding: 12px 18px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;

      .actions-spacer {
        flex: 1;
      }

      .primary-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        white-space: nowrap !important;
        height: 38px !important;
        padding: 0 14px !important;
        font-size: 0.85rem !important;

        mat-icon {
          font-size: 18px !important;
          width: 18px !important;
          height: 18px !important;
          line-height: 18px !important;
          margin: 0 !important;
        }

        span {
          white-space: nowrap !important;
        }
      }
    }

    .btn-unassign {
      background: #dc2626 !important;
      color: #ffffff !important;
      font-weight: 600;

      &:hover:not([disabled]) {
        background: #b91c1c !important;
      }
    }

    .btn-save {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 600;
    }

    .btn-confirm-transfer {
      background: #d97706 !important;
      color: #ffffff !important;
      font-weight: 600;
    }

    @media (max-width: 520px) {
      .dialog-actions {
        flex-direction: column !important;
        gap: 8px !important;
        padding: 10px 12px !important;

        .actions-spacer {
          display: none !important;
        }

        .primary-actions {
          width: 100% !important;
          display: flex !important;
          gap: 8px !important;
          order: 1 !important;

          .btn-cancel {
            flex: 1 !important;
            min-width: 70px !important;
            height: 38px !important;
          }

          .btn-save,
          .btn-confirm-transfer {
            flex: 1.5 !important;
            height: 38px !important;
            font-size: 0.82rem !important;
            padding: 0 8px !important;
          }
        }

        .btn-unassign {
          width: 100% !important;
          order: 2 !important;
          height: 36px !important;
          font-size: 0.82rem !important;
        }
      }
    }

    /* Badges for Assignment Status */
    .assign-badge-mini {
      display: inline-flex;
      align-items: center;
      font-size: 0.7rem;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 10px;

      &.current {
        background: #dcfce7;
        color: #15803d;
        border: 1px solid #86efac;
      }

      &.conflict {
        background: #fef3c7;
        color: #b45309;
        border: 1px solid #fde68a;
      }

      &.available {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #e2e8f0;
      }
    }

    /* In-Dropdown Sticky Search & Option Card Styling */
    ::ng-deep .faculty-select-panel {
      max-height: 280px !important;
    }

    ::ng-deep .cdk-overlay-pane:has(.faculty-select-panel) {
      max-height: 320px !important;
    }

    ::ng-deep .faculty-select-panel {
      .mat-mdc-option {
        height: auto !important;
        min-height: 54px !important;
        padding: 8px 14px !important;
        line-height: normal !important;
        border-bottom: 1px solid #f1f5f9;

        &:hover {
          background: #f8fafc !important;
        }

        &.mat-mdc-option-active {
          background: #eff6ff !important;
        }
      }

      .dropdown-search-wrapper {
        position: sticky;
        top: 0;
        z-index: 10;
        background: #ffffff;
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);

        .dd-search-icon {
          color: #2563eb;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .dd-search-input {
          flex: 1;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 0.85rem;
          outline: none;
          background: #f8fafc;
          color: #0f172a;
          transition: all 0.15s ease;

          &:focus {
            border-color: #2563eb;
            background: #ffffff;
            box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
          }

          &::placeholder {
            color: #94a3b8;
          }
        }

        .dd-clear-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          &:hover { color: #475569; }
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }

      .teacher-opt-card {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 4px;

        .opt-row-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 10px;

          .opt-identity {
            display: flex;
            align-items: center;
            gap: 6px;

            .opt-name {
              font-weight: 600;
              color: #0f172a;
              font-size: 0.9rem;
            }

            .opt-code {
              color: #64748b;
              font-size: 0.78rem;
            }
          }

          .assign-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 0.72rem;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 12px;
            white-space: nowrap;

            .b-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
            }

            &.current {
              background: #dcfce7;
              color: #15803d;
              border: 1px solid #86efac;
            }

            &.conflict {
              background: #fef3c7;
              color: #b45309;
              border: 1px solid #fde68a;
            }

            &.available {
              background: #f1f5f9;
              color: #475569;
              border: 1px solid #e2e8f0;
            }
          }
        }

        .opt-row-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          gap: 10px;
          font-size: 0.78rem;

          .opt-spec {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #2563eb;
            font-weight: 500;

            .sub-icon {
              font-size: 13px;
              width: 13px;
              height: 13px;
              color: #3b82f6;
            }
          }

          .opt-spec-placeholder {
            color: #94a3b8;
            font-style: italic;
          }

          .opt-phone {
            color: #64748b;
            font-size: 0.76rem;
            white-space: nowrap;
          }
        }
      }

      .dd-no-results {
        padding: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #64748b;
        font-size: 0.85rem;
        font-style: italic;

        mat-icon {
          color: #94a3b8;
          font-size: 20px;
          width: 20px;
          height: 20px;
        }
      }
    }
  `]
})
export class QuickClassTeacherDialogComponent implements OnInit {
  selectedTeacherId: string | null = null;
  selectedTeacher: TeacherDto | null = null;
  availableTeachers: TeacherDto[] = [];
  filteredTeachers: TeacherDto[] = [];
  searchQuery: string = '';
  conflictNotice: string | null = null;
  saving = false;

  // Map of TeacherId -> list of sections where this teacher is assigned as Class Teacher
  assignmentMap: Map<string, SectionAssignmentRecord[]> = new Map();

  @ViewChild('dropdownSearchInput') dropdownSearchInput?: ElementRef<HTMLInputElement>;

  constructor(
    public dialogRef: MatDialogRef<QuickClassTeacherDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickClassTeacherDialogData,
    private schoolService: SchoolService
  ) {}

  isTeachingStaff(t: any): boolean {
    if (!t) return false;
    const st = (t.staffType || '').toString().toLowerCase();
    if (st === 'nonteaching' || st.includes('non') || st === '2' || t.staffType === 2) return false;
    const dept = (t.department || '').toLowerCase();
    const desig = (t.designation || '').toLowerCase();
    const code = (t.employeeCode || '').toLowerCase();
    const name = (t.fullName || '').toLowerCase();
    if (code.startsWith('hr') || name.includes('(hr') || name.includes('hr manager') || dept.includes('hr') || dept.includes('human resource') || desig.includes('hr') || desig.includes('accountant') || desig.includes('receptionist') || desig.includes('driver')) {
      return false;
    }
    return true;
  }

  ngOnInit() {
    this.selectedTeacherId = this.data.currentClassTeacherId || null;
    this.availableTeachers = (this.data.teachers || []).filter(t => t.isActive && this.isTeachingStaff(t));
    if (this.data.currentClassTeacherId && !this.availableTeachers.some(t => t.id === this.data.currentClassTeacherId)) {
      const cur = (this.data.teachers || []).find(t => t.id === this.data.currentClassTeacherId);
      if (cur && this.isTeachingStaff(cur)) this.availableTeachers.unshift(cur);
    }
    this.filteredTeachers = [...this.availableTeachers];

    this.buildAssignmentMap();
    this.updateSelectedTeacher();
  }

  buildAssignmentMap() {
    this.assignmentMap.clear();
    const classes = this.data.classes || [];
    if (classes.length > 0) {
      for (const c of classes) {
        for (const s of (c.sections || [])) {
          if (s.classTeacherId) {
            const list = this.assignmentMap.get(s.classTeacherId) || [];
            list.push({
              className: c.name,
              sectionName: s.name,
              sectionId: s.id,
              isCurrent: s.id === this.data.sectionId
            });
            this.assignmentMap.set(s.classTeacherId, list);
          }
        }
      }
    } else {
      // Fallback: fetch matrix from schoolService
      this.schoolService.getClassTeachersMatrix().subscribe({
        next: (matrix) => {
          for (const item of (matrix || [])) {
            if (item.classTeacherId) {
              const list = this.assignmentMap.get(item.classTeacherId) || [];
              list.push({
                className: item.className,
                sectionName: item.sectionName,
                sectionId: item.sectionId,
                isCurrent: item.sectionId === this.data.sectionId
              });
              this.assignmentMap.set(item.classTeacherId, list);
            }
          }
        }
      });
    }
  }

  isCurrentSectionTeacher(teacherId: string): boolean {
    const list = this.assignmentMap.get(teacherId) || [];
    return list.some(r => r.isCurrent);
  }

  getOtherAssignedText(teacherId: string): string | null {
    const list = this.assignmentMap.get(teacherId) || [];
    const others = list.filter(r => !r.isCurrent);
    if (others.length === 0) return null;
    return others.map(o => `${o.className} - ${o.sectionName}`).join(', ');
  }

  isAssignedAnywhere(teacherId: string): boolean {
    const list = this.assignmentMap.get(teacherId) || [];
    return list.length > 0;
  }

  getSelectedTeacherOtherAssignmentText(): string | null {
    if (!this.selectedTeacherId) return null;
    return this.getOtherAssignedText(this.selectedTeacherId);
  }

  filterTeachers() {
    const q = (this.searchQuery || '').trim().toLowerCase();
    if (!q) {
      this.filteredTeachers = [...this.availableTeachers];
      return;
    }
    this.filteredTeachers = this.availableTeachers.filter(t => {
      const name = (t.fullName || '').toLowerCase();
      const code = (t.employeeCode || '').toLowerCase();
      const spec = (t.specialization || '').toLowerCase();
      const dept = (t.department || '').toLowerCase();
      const phone = (t.phoneNumber || '').toLowerCase();
      const otherAssigned = (this.getOtherAssignedText(t.id) || '').toLowerCase();
      const isCurrent = this.isCurrentSectionTeacher(t.id) ? 'assigned here' : '';
      const isAvailable = !this.isAssignedAnywhere(t.id) ? 'available unassigned' : '';

      return name.includes(q) ||
        code.includes(q) ||
        spec.includes(q) ||
        dept.includes(q) ||
        phone.includes(q) ||
        otherAssigned.includes(q) ||
        isCurrent.includes(q) ||
        isAvailable.includes(q);
    });
  }

  clearSearch() {
    this.searchQuery = '';
    this.filterTeachers();
  }

  onSelectOpened(isOpen: boolean) {
    if (isOpen) {
      setTimeout(() => {
        this.dropdownSearchInput?.nativeElement?.focus();
      }, 120);
    }
  }

  selectTeacher(t: TeacherDto) {
    this.selectedTeacherId = t.id;
    this.onTeacherChange();
  }

  get hasChanged(): boolean {
    const cur = this.data.currentClassTeacherId || null;
    return this.selectedTeacherId !== cur;
  }

  onTeacherChange() {
    this.conflictNotice = null;
    this.updateSelectedTeacher();
  }

  updateSelectedTeacher() {
    if (this.selectedTeacherId) {
      this.selectedTeacher = this.availableTeachers.find(t => t.id === this.selectedTeacherId) || this.data.teachers.find(t => t.id === this.selectedTeacherId) || null;
    } else {
      this.selectedTeacher = null;
    }
  }

  saveAssignment(force: boolean = false) {
    this.saving = true;
    this.conflictNotice = null;

    this.schoolService.quickAssignClassTeacher(this.data.sectionId, this.selectedTeacherId, force).subscribe({
      next: (res) => {
        this.saving = false;
        this.dialogRef.close({
          success: true,
          sectionId: this.data.sectionId,
          classTeacherId: this.selectedTeacherId,
          classTeacherName: this.selectedTeacher ? this.selectedTeacher.fullName : null,
          message: res?.message
        });
      },
      error: (err) => {
        this.saving = false;
        if (err.status === 409 && err.error?.requiresConfirmation) {
          this.conflictNotice = err.error.message;
        } else {
          alert(err.error?.message || 'Failed to update Class Teacher assignment.');
        }
      }
    });
  }

  unassignTeacher(): void {
    this.selectedTeacherId = null;
    this.selectedTeacher = null;
    this.saveAssignment(false);
  }

  onClose() {
    this.dialogRef.close(null);
  }
}
