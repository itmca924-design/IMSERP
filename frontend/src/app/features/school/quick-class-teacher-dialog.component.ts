import { Component, Inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
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
    CommonModule,
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
          <div>
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

      <mat-progress-bar mode="indeterminate" *ngIf="saving"></mat-progress-bar>

      <div class="dialog-body">
        <!-- Current Status Banner -->
        <div class="current-status-banner" [class.assigned]="data.currentClassTeacherId" [class.unassigned]="!data.currentClassTeacherId">
          <mat-icon class="status-icon">{{ data.currentClassTeacherId ? 'verified' : 'info' }}</mat-icon>
          <div class="status-text">
            <span class="status-label">Current Class Teacher:</span>
            <strong class="status-val">{{ data.currentClassTeacherName || 'No Teacher Assigned Yet' }}</strong>
          </div>
        </div>

        <!-- Conflict Alert if teacher is assigned elsewhere -->
        <div class="conflict-alert" *ngIf="conflictNotice || getSelectedTeacherOtherAssignmentText()">
          <div class="conflict-icon">
            <mat-icon>warning_amber</mat-icon>
          </div>
          <div class="conflict-content">
            <strong>Reassignment Notice</strong>
            <p *ngIf="conflictNotice">{{ conflictNotice }}</p>
            <p *ngIf="!conflictNotice && getSelectedTeacherOtherAssignmentText() as otherAssigned">
              <strong>{{ selectedTeacher?.fullName }}</strong> is currently assigned as Class Teacher for <strong>{{ otherAssigned }}</strong>.
            </p>
            <small>Saving this assignment will transfer this faculty to <strong>{{ data.className }} - {{ data.sectionName }}</strong>.</small>
          </div>
        </div>

        <!-- Teacher Search & Selection -->
        <div class="form-section">
          <!-- Real-time Quick Search Bar -->
          <div class="search-filter-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              class="search-input"
              [(ngModel)]="searchQuery"
              (ngModelChange)="filterTeachers()"
              placeholder="Search faculty by name, subject, code, class or 'available'..."
            />
            <button
              *ngIf="searchQuery"
              type="button"
              class="clear-btn"
              (click)="clearSearch()"
              title="Clear search"
            >
              <mat-icon>close</mat-icon>
            </button>
            <span class="results-badge" *ngIf="searchQuery">
              {{ filteredTeachers.length }} / {{ availableTeachers.length }}
            </span>
          </div>

          <!-- Quick Matching Chips (when searching and 1-4 results match) -->
          <div class="quick-chips-row" *ngIf="searchQuery && filteredTeachers.length > 0 && filteredTeachers.length <= 4">
            <span class="quick-chip-lbl">Quick pick:</span>
            <button
              type="button"
              class="quick-chip"
              *ngFor="let t of filteredTeachers"
              [class.active]="selectedTeacherId === t.id"
              (click)="selectTeacher(t)"
            >
              <span class="chip-name">{{ t.fullName }}</span>
              <span class="chip-assigned" *ngIf="getOtherAssignedText(t.id) as ot">({{ ot }})</span>
              <span class="chip-spec" *ngIf="!getOtherAssignedText(t.id) && t.specialization">({{ t.specialization }})</span>
            </button>
          </div>

          <!-- Mat Select Dropdown with Sticky In-Dropdown Search Header -->
          <mat-form-field appearance="outline" class="full-width faculty-field" style="margin-top: 10px;">
            <mat-label>Select Faculty (कक्षा अध्यापक)</mat-label>
            <mat-select
              [(ngModel)]="selectedTeacherId"
              (selectionChange)="onTeacherChange()"
              placeholder="Choose teacher..."
              panelClass="faculty-select-panel"
              (openedChange)="onSelectOpened($event)"
            >
              <mat-select-trigger>
                <div *ngIf="selectedTeacher" class="selected-trigger-box">
                  <div class="trigger-top">
                    <strong>{{ selectedTeacher.fullName }}</strong>
                    <span class="trigger-code">({{ selectedTeacher.employeeCode }})</span>
                    <span class="assign-badge-mini current" *ngIf="isCurrentSectionTeacher(selectedTeacher.id)">Assigned Here</span>
                    <span class="assign-badge-mini conflict" *ngIf="getOtherAssignedText(selectedTeacher.id) as otherText">{{ otherText }}</span>
                    <span class="assign-badge-mini available" *ngIf="!isAssignedAnywhere(selectedTeacher.id)">Available</span>
                  </div>
                  <span class="trigger-spec" *ngIf="selectedTeacher.specialization">&bull; {{ selectedTeacher.specialization }}</span>
                </div>
                <span *ngIf="!selectedTeacher" class="placeholder-text">
                  {{ selectedTeacherId === null ? '-- None (Unassigned) --' : 'Choose teacher...' }}
                </span>
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
                <button *ngIf="searchQuery" type="button" class="dd-clear-btn" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <mat-option [value]="null">
                <span class="unassigned-opt">-- None (Unassigned) --</span>
              </mat-option>

              <mat-option *ngFor="let t of filteredTeachers" [value]="t.id">
                <div class="teacher-opt-card">
                  <!-- Row 1: Identity & Class Assignment Status Badge -->
                  <div class="opt-row-top">
                    <div class="opt-identity">
                      <strong class="opt-name">{{ t.fullName }}</strong>
                      <span class="opt-code">({{ t.employeeCode }})</span>
                    </div>

                    <!-- Clear Visual Badge: Shows Assigned Class or Available -->
                    <span class="assign-badge current" *ngIf="isCurrentSectionTeacher(t.id)" matTooltip="Already Class Teacher of this section">
                      <mat-icon class="b-icon">check_circle</mat-icon> Assigned Here
                    </span>
                    <span class="assign-badge conflict" *ngIf="getOtherAssignedText(t.id) as otherText" [matTooltip]="'Already Class Teacher of ' + otherText">
                      <mat-icon class="b-icon">school</mat-icon> Class Teacher: {{ otherText }}
                    </span>
                    <span class="assign-badge available" *ngIf="!isAssignedAnywhere(t.id)" matTooltip="Available - Not assigned as Class Teacher in any class">
                      <mat-icon class="b-icon">verified_user</mat-icon> Available
                    </span>
                  </div>

                  <!-- Row 2: Subject Specialization & Phone -->
                  <div class="opt-row-bottom">
                    <span class="opt-spec" *ngIf="t.specialization">
                      <mat-icon class="sub-icon">menu_book</mat-icon> {{ t.specialization }}
                    </span>
                    <span class="opt-spec-placeholder" *ngIf="!t.specialization">&bull; General Faculty</span>
                    <span class="opt-phone" *ngIf="t.phoneNumber">📞 {{ t.phoneNumber }}</span>
                  </div>
                </div>
              </mat-option>

              <div class="dd-no-results" *ngIf="filteredTeachers.length === 0">
                <mat-icon>person_search</mat-icon>
                <span>No faculty found matching "<strong>{{ searchQuery }}</strong>"</span>
              </div>
            </mat-select>
            <mat-hint *ngIf="searchQuery">
              Showing {{ filteredTeachers.length }} of {{ availableTeachers.length }} faculty members
            </mat-hint>
          </mat-form-field>
        </div>

        <!-- Selected Teacher Card Preview -->
        <div class="teacher-preview-card" *ngIf="selectedTeacher">
          <div class="preview-avatar">
            <mat-icon>account_circle</mat-icon>
          </div>
          <div class="preview-details">
            <div class="preview-name-row">
              <span class="preview-name">{{ selectedTeacher.fullName }}</span>
              <span class="assign-badge-mini current" *ngIf="isCurrentSectionTeacher(selectedTeacher.id)">Assigned Here</span>
              <span class="assign-badge-mini conflict" *ngIf="getOtherAssignedText(selectedTeacher.id) as ot">Class Teacher: {{ ot }}</span>
              <span class="assign-badge-mini available" *ngIf="!isAssignedAnywhere(selectedTeacher.id)">Available</span>
            </div>
            <div class="preview-sub">
              <span>Code: <strong>{{ selectedTeacher.employeeCode }}</strong></span>
              <span *ngIf="selectedTeacher.phoneNumber">&bull; 📞 {{ selectedTeacher.phoneNumber }}</span>
              <span *ngIf="selectedTeacher.specialization">&bull; {{ selectedTeacher.specialization }}</span>
            </div>
          </div>
        </div>

        <div class="role-help-note">
          <mat-icon>lightbulb</mat-icon>
          <span>The Class Teacher is responsible for student attendance, report card signatures, class discipline, and direct parent communications for this section.</span>
        </div>
      </div>

      <!-- Dialog Actions -->
      <div class="dialog-actions">
        <button mat-button class="btn-cancel" (click)="onClose()" [disabled]="saving">Cancel</button>
        <button mat-flat-button color="warn" class="btn-unassign" *ngIf="data.currentClassTeacherId && selectedTeacherId === null" (click)="saveAssignment(false)" [disabled]="saving">
          <mat-icon>person_remove</mat-icon> Remove Class Teacher
        </button>
        <button mat-flat-button color="primary" class="btn-save" *ngIf="!conflictNotice && !getSelectedTeacherOtherAssignmentText()" (click)="saveAssignment(false)" [disabled]="saving || !hasChanged">
          <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon> Save Assignment
        </button>
        <button mat-flat-button color="accent" class="btn-confirm-transfer" *ngIf="conflictNotice || getSelectedTeacherOtherAssignmentText()" (click)="saveAssignment(true)" [disabled]="saving || !hasChanged">
          <mat-icon>swap_horiz</mat-icon> Confirm & Transfer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      width: 100%;
      max-width: 540px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    /* Strict Light Blue Gradient Header matching AGENTS.md rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
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
      width: 44px;
      height: 44px;
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dialog-title {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e3a8a;
    }

    .dialog-subtitle {
      margin: 2px 0 0;
      font-size: 0.85rem;
      color: #3b82f6;
    }

    .dialog-subtitle strong {
      color: #1e40af;
    }

    .close-btn {
      color: #64748b;
      transition: color 0.15s ease;
    }

    .close-btn:hover {
      color: #1e293b;
    }

    /* Dialog Body */
    .dialog-body {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .current-status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
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
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .status-text {
      display: flex;
      flex-direction: column;
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
      padding: 14px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
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
      max-height: 440px !important;

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

  onClose() {
    this.dialogRef.close(null);
  }
}
