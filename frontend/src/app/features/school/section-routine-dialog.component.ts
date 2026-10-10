import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SchoolService, SectionPeriodRoutineDto, CreateSectionPeriodRequestDto } from '../../core/services/school.service';
import { SubjectsService, ClassSubjectDto } from '../../core/services/subjects.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { TeacherDto } from '../teachers/teacher.models';

export interface SectionRoutineDialogData {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  classTeacherId?: string | null;
  classTeacherName?: string | null;
  classTeacherPhone?: string | null;
  branchId?: string | null;
  teachers: TeacherDto[];
}

@Component({
  selector: 'app-section-routine-dialog',
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
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict Light Blue Header matching Rule -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>calendar_view_week</mat-icon>
          </div>
          <div>
            <h2 class="dialog-title">Class Routine & Subject Allocation</h2>
            <p class="dialog-subtitle">
              Weekly schedule & period faculty for <strong>{{ data.className }} - {{ data.sectionName }}</strong>
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-icon-button class="print-btn" (click)="printRoutine()" [disabled]="routine.length === 0" matTooltip="Print Section Routine">
            <mat-icon>print</mat-icon>
          </button>
          <button mat-icon-button class="close-btn" (click)="onClose()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading || saving"></mat-progress-bar>

      <div class="dialog-body">
        <!-- Section Info & Class Teacher Banner -->
        <div class="section-meta-banner">
          <div class="meta-item">
            <div class="meta-icon-badge">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div>
              <span class="meta-label">Class & Section</span>
              <strong class="meta-val">{{ data.className }} &bull; {{ data.sectionName }}</strong>
            </div>
          </div>

          <div class="meta-item ct-box" [class.has-ct]="data.classTeacherId">
            <div class="meta-icon-badge ct-badge">
              <mat-icon>{{ data.classTeacherId ? 'verified_user' : 'person_off' }}</mat-icon>
            </div>
            <div>
              <span class="meta-label">Class Teacher (कक्षा अध्यापक)</span>
              <strong class="meta-val">{{ data.classTeacherName || 'No Class Teacher Assigned' }}</strong>
            </div>
          </div>

          <div class="meta-action" *ngIf="data.classTeacherId && !isClassTeacherAssignedToPeriod">
            <button type="button" class="quick-ct-btn" (click)="quickPickClassTeacher()" matTooltip="Quickly pre-fill form to assign Class Teacher to a subject">
              <mat-icon>star</mat-icon> Assign {{ classTeacherFirstName }}
            </button>
          </div>
        </div>

        <!-- Clash Alert Notice -->
        <div class="clash-alert" *ngIf="clashWarning">
          <mat-icon class="clash-icon">warning_amber</mat-icon>
          <div class="clash-text">
            <strong>Faculty Schedule Clash Detected!</strong>
            <p>{{ clashWarning }}</p>
            <div class="clash-actions">
              <button mat-flat-button color="primary" class="btn-pick-free" (click)="pickFirstAvailableTeacher()">
                <mat-icon>auto_awesome</mat-icon> Pick Free Teacher (खाली शिक्षक चुनें)
              </button>
              <button mat-flat-button color="warn" class="btn-override" (click)="submitPeriod(true)">
                <mat-icon>priority_high</mat-icon> Schedule Anyway (Override Clash)
              </button>
              <button mat-button (click)="clashWarning = null">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Routine Periods Table -->
        <div class="routine-section">
          <div class="section-title-row">
            <div class="title-with-badge">
              <h3 class="section-heading"><mat-icon>schedule</mat-icon> Scheduled Periods ({{ routine.length }})</h3>
              <span class="coverage-pill" *ngIf="routine.length > 0">{{ uniqueSubjects.length }} Subjects Configured</span>
            </div>
            <button type="button" class="add-period-toggle" (click)="toggleAddForm()">
              <mat-icon>{{ showAddForm ? 'remove' : 'add' }}</mat-icon>
              {{ showAddForm ? 'Hide Form' : 'Add Subject Period' }}
            </button>
          </div>

          <!-- Add/Assign Period Form Drawer -->
          <div class="add-period-card" *ngIf="showAddForm">
            <div class="form-title-row">
              <h4 class="form-title">
                <mat-icon>{{ editingPeriodId ? 'edit_calendar' : 'add_task' }}</mat-icon>
                {{ editingPeriodId ? 'Edit Period / Change Faculty' : 'Add Period / Subject Slot' }}
              </h4>
              <button type="button" class="auto-fill-btn" (click)="autoFillNextSlot()" *ngIf="!editingPeriodId" matTooltip="Auto-pick next unassigned subject, empty period, and available teacher">
                <mat-icon>auto_awesome</mat-icon> Auto-Fill Next Slot (खाली स्लॉट भरें)
              </button>
            </div>

            <!-- Quick Subject Suggestions -->
            <div class="form-group">
              <div class="subject-header-row">
                <label class="field-label">Subject (विषय) *</label>
                <span class="curr-pill" *ngIf="classSubjects.length > 0">
                  <mat-icon>verified</mat-icon> {{ classSubjects.length }} Curriculum Subjects
                </span>
              </div>
              <div class="subject-chips">
                <button type="button" *ngFor="let s of displaySubjects; trackBy: trackBySubject"
                  class="subj-chip"
                  [class.curriculum-chip]="s.isCurriculum"
                  [class.already-configured]="isSubjectAssigned(s.name)"
                  [class.active]="newSubject && (newSubject.trim().toLowerCase() === (s.name || '').trim().toLowerCase())"
                  (click)="pickSubject(s)"
                  [matTooltip]="isSubjectAssigned(s.name) ? 'Already scheduled in this section' : (s.teacherId ? 'Auto-selects assigned subject teacher if available' : '')">
                  <span *ngIf="isSubjectAssigned(s.name)" class="check-icon">✓ </span>
                  <span *ngIf="!isSubjectAssigned(s.name) && s.isCurriculum" class="star-icon">⭐ </span>{{ s.name }}
                  <span *ngIf="isSubjectAssigned(s.name)" class="badge-done">Already Configured</span>
                  <span *ngIf="!isSubjectAssigned(s.name)" class="badge-pending">Unassigned</span>
                </button>
              </div>
              <input type="text" [(ngModel)]="newSubject" placeholder="Or enter subject name (e.g. Sanskrit, Moral Science)..." class="custom-input" />
            </div>

            <!-- Faculty Selection -->
            <div class="form-group">
              <div class="fac-label-row">
                <label class="field-label">Faculty Member (शिक्षक) *</label>
                <span class="fac-availability-tag clash" *ngIf="selectedTeacherClash">
                  <mat-icon>error</mat-icon> Busy in other class!
                </span>
                <span class="fac-availability-tag free" *ngIf="!selectedTeacherClash && selectedTeacherId">
                  <mat-icon>check_circle</mat-icon> Available at this slot
                </span>
              </div>
              <select [(ngModel)]="selectedTeacherId" class="custom-select" [class.input-clash]="selectedTeacherClash">
                <option value="">-- Choose Teacher --</option>
                <optgroup [label]="'🟢 Available Faculty (उपलब्ध शिक्षक - कोई Clash नहीं) (' + availableTeachers.length + ' Free)'" *ngIf="availableTeachers.length > 0">
                  <option *ngIf="classTeacherObj && !isTeacherClashed(classTeacherObj.id)" [value]="classTeacherObj.id" style="font-weight: 700; color: #1e3a8a;">
                    ⭐ {{ classTeacherObj.fullName }} ({{ classTeacherObj.employeeCode }}) — Class Teacher [Available]
                  </option>
                  <option *ngFor="let t of availableNonCtTeachers; trackBy: trackByTeacherId" [value]="t.id">
                    🟢 {{ t.fullName }} ({{ t.employeeCode }}) {{ t.specialization ? '• ' + t.specialization : '' }}
                  </option>
                </optgroup>
                <optgroup [label]="'🔴 Busy Faculty (व्यस्त शिक्षक - दूसरी क्लास में शेड्यूल) (' + busyTeachers.length + ' Busy)'" *ngIf="busyTeachers.length > 0">
                  <option *ngIf="classTeacherObj && isTeacherClashed(classTeacherObj.id)" [value]="classTeacherObj.id" style="color: #991b1b;">
                    ⚠️ {{ classTeacherObj.fullName }} ({{ classTeacherObj.employeeCode }}) — Busy in {{ getTeacherClash(classTeacherObj.id) }}
                  </option>
                  <option *ngFor="let t of busyNonCtTeachers; trackBy: trackByTeacherId" [value]="t.id" style="color: #991b1b;">
                    ⚠️ {{ t.fullName }} ({{ t.employeeCode }}) — Busy in {{ getTeacherClash(t.id) }}
                  </option>
                </optgroup>
              </select>
              <!-- Inline teacher clash helper box -->
              <div class="teacher-inline-clash-box" *ngIf="selectedTeacherClash">
                <div class="clash-inline-text">
                  <mat-icon>warning</mat-icon>
                  <span><strong>{{ selectedTeacherObj?.fullName }}</strong> is busy: {{ selectedTeacherClash }}</span>
                </div>
                <button type="button" class="btn-quick-fix-teacher" (click)="pickFirstAvailableTeacher()">
                  <mat-icon>auto_fix_high</mat-icon> Pick Available Teacher
                </button>
              </div>
            </div>

            <!-- Days Selection -->
            <div class="form-group">
              <div class="days-label-row">
                <label class="field-label">Scheduled Days *</label>
                <div class="quick-days-btns">
                  <button type="button" class="q-day-btn" (click)="setAllDays()">Mon-Sat (All)</button>
                  <button type="button" class="q-day-btn" (click)="setWeekdays()">Mon-Fri</button>
                  <button type="button" class="q-day-btn" (click)="setAltDays()">Mon, Wed, Fri</button>
                </div>
              </div>
              <div class="days-pills">
                <button type="button" *ngFor="let day of weekDaysList"
                  class="day-pill"
                  [class.selected]="isDaySelected(day)"
                  (click)="toggleDay(day)">
                  {{ day }}
                </button>
              </div>
            </div>

            <!-- Period / Timing -->
            <div class="form-group">
              <label class="field-label">Period / Timing Slot *</label>
              <div class="period-chips">
                <button type="button" *ngFor="let p of presetPeriods"
                  class="p-chip"
                  [class.active]="selectedTimeSlot === p.slot"
                  [class.period-taken]="isPeriodAssigned(p.slot)"
                  (click)="onSelectPeriodSlot(p.slot)">
                  <div class="p-top-row">
                    <span class="p-name">{{ p.name }}</span>
                    <span class="p-tag-pill" *ngIf="getPeriodSubjectName(p.slot)">✓ {{ getPeriodSubjectName(p.slot) }}</span>
                    <span class="p-tag-pill free-tag" *ngIf="!getPeriodSubjectName(p.slot)">🟢 Free</span>
                  </div>
                  <span class="p-time">{{ p.slot }}</span>
                </button>
              </div>
              <input type="text" [(ngModel)]="selectedTimeSlot" placeholder="Or type custom slot (e.g. 08:30 AM - 09:15 AM)..." class="custom-input" />
            </div>

            <!-- Action Buttons -->
            <div class="form-actions">
              <button mat-button (click)="resetForm()" [disabled]="saving">Cancel</button>
              <button mat-flat-button color="primary" class="save-slot-btn" (click)="submitPeriod(false)" [disabled]="saving">
                <mat-icon>{{ saving ? 'hourglass_empty' : (editingPeriodId ? 'check_circle' : 'save') }}</mat-icon>
                {{ editingPeriodId ? 'Update Period Slot' : 'Save Period Slot' }}
              </button>
            </div>
          </div>

          <!-- Existing Periods Table -->
          <div class="routine-table-container" *ngIf="routine.length > 0">
            <table class="routine-table">
              <thead>
                <tr>
                  <th>Period / Time</th>
                  <th>Subject</th>
                  <th>Assigned Faculty</th>
                  <th>Days</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of routine" [class.is-ct-row]="p.isClassTeacher">
                  <td class="col-slot">
                    <div class="slot-pill">
                      <mat-icon>alarm</mat-icon>
                      <span>{{ p.timeSlot || 'Timing Unspecified' }}</span>
                    </div>
                  </td>
                  <td class="col-subject">
                    <span class="subject-tag">{{ p.subject }}</span>
                  </td>
                  <td class="col-teacher">
                    <div class="teacher-cell">
                      <div class="t-avatar" [class.ct-avatar]="p.isClassTeacher">
                        {{ p.teacherName.charAt(0) | uppercase }}
                      </div>
                      <div class="t-info">
                        <strong class="t-name">{{ p.teacherName }}</strong>
                        <div class="t-sub">
                          <span class="t-code">{{ p.teacherEmployeeCode }}</span>
                          <span class="ct-badge-pill" *ngIf="p.isClassTeacher">Class Teacher</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="col-days">
                    <div class="days-badges">
                      <span class="day-chip" *ngFor="let d of getDaysArray(p.daysOfWeek)">{{ d }}</span>
                    </div>
                  </td>
                  <td class="col-action">
                    <div class="action-btn-group">
                      <button mat-icon-button (click)="editPeriod(p)" matTooltip="Edit Period / Change Faculty" class="edit-btn">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button color="warn" (click)="deletePeriod(p)" matTooltip="Remove Period" class="del-btn">
                        <mat-icon>delete_outline</mat-icon>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          <div class="empty-routine" *ngIf="routine.length === 0 && !showAddForm">
            <div class="empty-icon">
              <mat-icon>event_busy</mat-icon>
            </div>
            <h4>No periods scheduled yet</h4>
            <p>Configure weekly timetable for <strong>{{ data.className }} - {{ data.sectionName }}</strong> by adding subjects and assigned faculty members.</p>
            <button mat-flat-button color="primary" class="start-btn" (click)="showAddForm = true; autoFillNextSlot()">
              <mat-icon>auto_awesome</mat-icon> Setup Class Routine (खाली स्लॉट भरें)
            </button>
          </div>
        </div>
      </div>

      <!-- Dialog Footer -->
      <div class="dialog-footer">
        <span class="footer-note">
          <mat-icon>info</mat-icon> Changes take effect immediately across faculty timetable and lesson diaries.
        </span>
        <button mat-flat-button color="primary" (click)="onClose()">
          Done
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      width: 100%;
      max-width: 1180px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }

    /* Strict Light Blue Gradient Header matching Rule */
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 22px;
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
      box-shadow: 0 0 12px 2px rgba(37, 99, 235, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }

    .dialog-title {
      margin: 0;
      font-size: 1.22rem;
      font-weight: 700;
      color: #1e3a8a;
      line-height: 1.25;
    }

    .dialog-subtitle {
      margin: 3px 0 0;
      font-size: 0.85rem;
      color: #3b82f6;
      strong { color: #1e40af; }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .close-btn, .print-btn {
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      padding: 0 !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      outline: none !important;
      border: none !important;
      position: relative !important;
      cursor: pointer;

      .mat-mdc-button-persistent-ripple,
      .mat-mdc-focus-indicator {
        border-radius: 50% !important;
        inset: 0 !important;
        width: 36px !important;
        height: 36px !important;
      }
      .mat-mdc-button-persistent-ripple::before {
        display: none !important;
      }
      .mat-mdc-button-touch-target {
        display: none !important;
      }

      mat-icon {
        font-size: 20px !important;
        width: 20px !important;
        height: 20px !important;
        line-height: 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }

    .close-btn {
      color: #64748b;
      &:hover { color: #1e293b; background: rgba(0, 0, 0, 0.06) !important; }
    }

    .print-btn {
      color: #1e40af;
      &:hover { color: #1d4ed8; background: #dbeafe !important; }
    }

    .dialog-body {
      padding: 18px 22px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Top Section Info Banner */
    .section-meta-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 10px;

      .meta-icon-badge {
        width: 34px;
        height: 34px;
        border-radius: 8px;
        background: #e2e8f0;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }

      .meta-label {
        font-size: 0.72rem;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: block;
      }

      .meta-val {
        font-size: 0.92rem;
        color: #0f172a;
      }

      &.ct-box.has-ct {
        .ct-badge {
          background: #eff6ff;
          color: #2563eb;
        }
        .meta-val {
          color: #1e40af;
        }
      }
    }

    .meta-action {
      margin-left: auto;
    }

    .quick-ct-btn {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;

      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #f59e0b; }
      &:hover { background: #dbeafe; border-color: #93c5fd; }
    }

    /* Clash Warning */
    .clash-alert {
      background: #fef2f2;
      border: 1.5px solid #fecaca;
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      gap: 12px;
      align-items: flex-start;

      .clash-icon { color: #dc2626; font-size: 22px; width: 22px; height: 22px; }
      .clash-text {
        font-size: 0.85rem;
        color: #991b1b;
        strong { display: block; margin-bottom: 2px; }
        p { margin: 0 0 8px; }
      }
      .clash-actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .btn-override { font-weight: 700; font-size: 0.78rem; }
    }

    /* Routine Section */
    .routine-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
    }

    .title-with-badge {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-heading {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }

    .coverage-pill {
      font-size: 0.72rem;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
    }

    .add-period-toggle {
      background: #2563eb;
      color: #ffffff;
      border: none;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &:hover { background: #1d4ed8; }
    }

    /* Add Period Drawer Card */
    .add-period-card {
      background: #ffffff;
      border: 2px solid #93c5fd;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 20px -4px rgba(37,99,235,0.12);
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .form-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    .auto-fill-btn {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #93c5fd;
      color: #1d4ed8;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
      &:hover { background: #dbeafe; border-color: #60a5fa; transform: translateY(-1px); }
    }

    .fac-label-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.76rem;
    }

    .fac-availability-tag {
      font-size: 0.74rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.clash { color: #dc2626; }
      &.free { color: #16a34a; }
    }

    .input-clash {
      border-color: #f87171 !important;
      background: #fff5f5 !important;
    }

    .teacher-inline-clash-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 8px 12px;
      margin-top: 4px;
      font-size: 0.8rem;
      color: #991b1b;
      gap: 8px;
      flex-wrap: wrap;

      .clash-inline-text {
        display: flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #dc2626; flex-shrink: 0; }
      }

      .btn-quick-fix-teacher {
        background: #2563eb;
        color: #fff;
        border: none;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #fff; }
        &:hover { background: #1d4ed8; }
      }
    }

    .btn-pick-free {
      font-weight: 700;
      font-size: 0.78rem;
      background: #2563eb !important;
      color: #fff !important;
    }

    .form-title {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #1e3a8a;
      display: flex;
      align-items: center;
      gap: 6px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field-label {
      font-size: 0.78rem;
      font-weight: 700;
      color: #334155;
    }

    .subject-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 4px;

      .curr-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #eff6ff;
        color: #1d4ed8;
        border: 1px solid #bfdbfe;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 12px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #2563eb; }
      }
    }

    .subject-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 4px;
    }

    .subj-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #334155;
      font-size: 0.76rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 14px;
      cursor: pointer;
      transition: all 0.15s;
      &:hover { background: #e2e8f0; }

      &.curriculum-chip {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
        font-weight: 700;
        &:hover { background: #dbeafe; }
      }

      &.active {
        background: #2563eb !important;
        color: #ffffff !important;
        border-color: #2563eb !important;
      }
    }

    .custom-input, .custom-select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.88rem;
      color: #0f172a;
      outline: none;
      transition: border-color 0.15s;
      &:focus { border-color: #2563eb; }
    }

    .days-label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .quick-days-btns {
      display: flex;
      gap: 6px;
    }

    .q-day-btn {
      background: transparent;
      border: none;
      color: #2563eb;
      font-size: 0.72rem;
      font-weight: 700;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      &:hover { background: #eff6ff; }
    }

    .days-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .day-pill {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      color: #475569;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.15s;
      &:hover { background: #f1f5f9; }
      &.selected {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
      }
    }

    .period-chips {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 6px;
      margin-bottom: 4px;
    }

    .p-chip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      cursor: pointer;
      transition: all 0.15s;
      .p-name { font-size: 0.74rem; font-weight: 700; color: #1e3a8a; }
      .p-time { font-size: 0.7rem; color: #64748b; }
      &:hover { background: #f1f5f9; border-color: #cbd5e1; }
      &.active {
        background: #eff6ff;
        border-color: #2563eb;
        .p-name { color: #1d4ed8; }
        .p-time { color: #2563eb; font-weight: 600; }
      }
      &.period-taken {
        border-color: #bfdbfe;
        background: #f8fafc;
      }
    }

    .p-top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      margin-bottom: 2px;
    }

    .p-tag-pill {
      font-size: 0.65rem;
      font-weight: 700;
      color: #1e40af;
      background: #dbeafe;
      padding: 1px 5px;
      border-radius: 4px;
      &.free-tag {
        background: #dcfce7;
        color: #15803d;
      }
    }

    .subj-chip.already-configured {
      background: #f0fdf4 !important;
      border-color: #bbf7d0 !important;
      color: #166534 !important;
      .badge-done {
        font-size: 0.65rem;
        font-weight: 700;
        background: #dcfce7;
        color: #15803d;
        padding: 1px 5px;
        border-radius: 4px;
        margin-left: 4px;
      }
    }

    .subj-chip .badge-pending {
      font-size: 0.65rem;
      font-weight: 700;
      background: #eff6ff;
      color: #2563eb;
      padding: 1px 5px;
      border-radius: 4px;
      margin-left: 4px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 4px;
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }

    .save-slot-btn {
      background: #2563eb !important;
      color: #ffffff !important;
      font-weight: 700;
    }

    /* Routine Table */
    .routine-table-container {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #ffffff;
    }

    .routine-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;

      th {
        background: #f8fafc;
        border-bottom: 1.5px solid #e2e8f0;
        padding: 10px 14px;
        text-align: left;
        font-weight: 700;
        color: #475569;
        font-size: 0.76rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      td {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
      }

      tr:last-child td { border-bottom: none; }
      tr:hover td { background: #fafafa; }
      tr.is-ct-row td { background: #f0fdf4; }

      .col-slot { width: 190px; }
      .col-subject { width: 180px; }
      .col-teacher { min-width: 260px; }
      .col-days { width: 300px; }
      .col-action { width: 70px; text-align: center; }
    }

    .slot-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
      color: #1e293b;
      font-size: 0.82rem;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #2563eb; }
    }

    .subject-tag {
      display: inline-block;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      font-weight: 700;
      font-size: 0.8rem;
      padding: 3px 10px;
      border-radius: 6px;
    }

    .teacher-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .t-avatar {
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      &.ct-avatar {
        background: #16a34a;
        color: #ffffff;
      }
    }

    .t-info {
      display: flex;
      flex-direction: column;
    }

    .t-name {
      font-size: 0.85rem;
      color: #0f172a;
    }

    .t-sub {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .t-code {
      font-size: 0.72rem;
      color: #64748b;
      white-space: nowrap;
    }

    .ct-badge-pill {
      font-size: 0.65rem;
      background: #dcfce7;
      color: #15803d;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
      white-space: nowrap;
    }

    .days-badges {
      display: flex;
      gap: 4px;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    .day-chip {
      background: #f1f5f9;
      color: #334155;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .col-action { width: 90px; text-align: right; }

    .action-btn-group {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      justify-content: flex-end;
    }

    .edit-btn, .del-btn {
      width: 32px !important;
      height: 32px !important;
      min-width: 32px !important;
      padding: 0 !important;
      border-radius: 50% !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      outline: none !important;
      position: relative !important;

      .mat-mdc-button-persistent-ripple,
      .mat-mdc-focus-indicator {
        border-radius: 50% !important;
        inset: 0 !important;
        width: 32px !important;
        height: 32px !important;
      }
      .mat-mdc-button-persistent-ripple::before {
        display: none !important;
      }
      .mat-mdc-button-touch-target {
        display: none !important;
      }

      mat-icon {
        font-size: 18px !important;
        width: 18px !important;
        height: 18px !important;
        line-height: 18px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }

    .edit-btn {
      color: #2563eb;
      &:hover { color: #1d4ed8; background: #eff6ff !important; }
    }

    .del-btn {
      color: #94a3b8;
      &:hover { color: #ef4444; background: #fee2e2 !important; }
    }

    /* Empty Routine */
    .empty-routine {
      text-align: center;
      padding: 36px 16px;
      background: #f8fafc;
      border: 1.5px dashed #cbd5e1;
      border-radius: 12px;
      .empty-icon mat-icon { font-size: 42px; width: 42px; height: 42px; color: #94a3b8; }
      h4 { margin: 8px 0 4px; font-size: 1rem; color: #1e293b; }
      p { margin: 0 0 16px; font-size: 0.84rem; color: #64748b; }
      .start-btn { font-weight: 700; background: #2563eb !important; color: #fff !important; }
    }

    /* Footer */
    .dialog-footer {
      border-top: 1px solid #e2e8f0;
      padding: 12px 22px;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-radius: 0 0 12px 12px;
    }

    .footer-note {
      font-size: 0.78rem;
      color: #64748b;
      display: flex;
      align-items: center;
      gap: 5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #3b82f6; }
    }
  `]
})
export class SectionRoutineDialogComponent implements OnInit {
  routine: SectionPeriodRoutineDto[] = [];
  loading = false;
  saving = false;
  showAddForm = false;
  clashWarning: string | null = null;
  editingPeriodId: string | null = null;

  readonly popularSubjects = [
    'Mathematics', 'English', 'Science', 'Hindi',
    'Social Science', 'Computer', 'Drawing', 'EVS', 'Moral Science'
  ];

  readonly weekDaysList = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  presetPeriods: { name: string; slot: string; isBreak?: boolean }[] = [];

  newSubject = '';
  selectedTeacherId = '';
  selectedDays: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  selectedTimeSlot = '';

  classSubjects: ClassSubjectDto[] = [];
  loadingClassSubjects = false;
  allSchoolRoutines: SectionPeriodRoutineDto[] = [];

  constructor(
    public dialogRef: MatDialogRef<SectionRoutineDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SectionRoutineDialogData,
    private schoolService: SchoolService,
    private subjectsService: SubjectsService,
    private confirmDialog: ConfirmDialogService
  ) {}

  displaySubjects: { name: string; teacherId?: string; isCurriculum: boolean }[] = [];

  updateDisplaySubjects(): void {
    if (this.classSubjects && this.classSubjects.length > 0) {
      this.displaySubjects = this.classSubjects.map(cs => ({
        name: cs.subjectName,
        teacherId: cs.teacherId,
        isCurriculum: true
      }));
    } else {
      this.displaySubjects = this.popularSubjects.map(s => ({
        name: s,
        isCurriculum: false
      }));
    }
  }

  trackBySubject(index: number, item: { name: string; teacherId?: string; isCurriculum: boolean }): string {
    return item ? item.name : `${index}`;
  }

  trackByTeacherId(index: number, item: TeacherDto): string {
    return item ? item.id : `${index}`;
  }

  private normalizeSlot(s?: string): string {
    return (s || '').replace(/[\u2010-\u2015\u2212–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private normalizeDay(d: string): string {
    return d.trim().substring(0, 3).toLowerCase();
  }

  isSubjectAssigned(subjectName: string): boolean {
    if (!subjectName) return false;
    const nameNorm = subjectName.trim().toLowerCase();
    return this.routine.some(r => 
      (r.subject || '').trim().toLowerCase() === nameNorm && 
      (!this.editingPeriodId || r.id !== this.editingPeriodId)
    );
  }

  isPeriodAssigned(slot: string): boolean {
    if (!slot) return false;
    const slotNorm = this.normalizeSlot(slot);
    return this.routine.some(r => 
      this.normalizeSlot(r.timeSlot) === slotNorm && 
      (!this.editingPeriodId || r.id !== this.editingPeriodId)
    );
  }

  getPeriodSubjectName(slot: string): string | null {
    if (!slot) return null;
    const slotNorm = this.normalizeSlot(slot);
    const found = this.routine.find(r => 
      this.normalizeSlot(r.timeSlot) === slotNorm && 
      (!this.editingPeriodId || r.id !== this.editingPeriodId)
    );
    return found ? found.subject : null;
  }

  getTeacherClash(teacherId: string): string | null {
    if (!teacherId || !this.selectedTimeSlot) return null;
    const currentSlotNorm = this.normalizeSlot(this.selectedTimeSlot);
    const selectedDaysNorm = this.selectedDays.map(d => this.normalizeDay(d));

    const clash = this.allSchoolRoutines.find(r => {
      if (r.teacherId !== teacherId) return false;
      if (this.editingPeriodId && r.id === this.editingPeriodId) return false;

      const rSlotNorm = this.normalizeSlot(r.timeSlot);
      if (rSlotNorm !== currentSlotNorm) return false;

      const rDays = this.getDaysArray(r.daysOfWeek).map(d => this.normalizeDay(d));
      return selectedDaysNorm.some(d => rDays.includes(d));
    });

    if (clash) {
      const clsName = clash.className ? `${clash.className} - ${clash.sectionName}` : 'Another class';
      return `${clsName} (${clash.subject})`;
    }
    return null;
  }

  isTeacherClashed(teacherId: string): boolean {
    return this.getTeacherClash(teacherId) !== null;
  }

  get selectedTeacherClash(): string | null {
    return this.selectedTeacherId ? this.getTeacherClash(this.selectedTeacherId) : null;
  }

  get selectedTeacherObj(): TeacherDto | undefined {
    return (this.data.teachers || []).find(t => t.id === this.selectedTeacherId);
  }

  get availableTeachers(): TeacherDto[] {
    const list = (this.data.teachers || []).filter(t => t.isActive && this.isTeachingStaff(t));
    return list.filter(t => !this.isTeacherClashed(t.id));
  }

  get busyTeachers(): TeacherDto[] {
    const list = (this.data.teachers || []).filter(t => t.isActive && this.isTeachingStaff(t));
    return list.filter(t => this.isTeacherClashed(t.id));
  }

  get availableNonCtTeachers(): TeacherDto[] {
    return this.nonCtTeachers.filter(t => !this.isTeacherClashed(t.id));
  }

  get busyNonCtTeachers(): TeacherDto[] {
    return this.nonCtTeachers.filter(t => this.isTeacherClashed(t.id));
  }

  pickFirstAvailableTeacher(): void {
    this.clashWarning = null;
    if (this.classTeacherObj && !this.isTeacherClashed(this.classTeacherObj.id)) {
      this.selectedTeacherId = this.classTeacherObj.id;
      return;
    }
    const free = this.availableNonCtTeachers;
    if (free.length > 0) {
      this.selectedTeacherId = free[0].id;
      return;
    }
    const anyFree = this.availableTeachers;
    if (anyFree.length > 0) {
      this.selectedTeacherId = anyFree[0].id;
    }
  }

  onSelectPeriodSlot(slot: string): void {
    this.selectedTimeSlot = slot;
    this.clashWarning = null;
    if (this.selectedTeacherId && this.isTeacherClashed(this.selectedTeacherId)) {
      this.pickFirstAvailableTeacher();
    }
  }

  pickSubject(item: { name: string; teacherId?: string; isCurriculum: boolean }): void {
    if (this.newSubject && this.newSubject.trim().toLowerCase() === (item.name || '').trim().toLowerCase()) {
      this.newSubject = '';
    } else {
      this.newSubject = item.name;
      this.clashWarning = null;

      // Auto-assign next free period if current period is already taken by another subject
      if (this.isPeriodAssigned(this.selectedTimeSlot)) {
        const nextFreePeriod = this.presetPeriods.find(p => !this.isPeriodAssigned(p.slot));
        if (nextFreePeriod) {
          this.selectedTimeSlot = nextFreePeriod.slot;
        }
      }

      if (item.teacherId && !this.isTeacherClashed(item.teacherId)) {
        this.selectedTeacherId = item.teacherId;
      } else {
        this.pickFirstAvailableTeacher();
      }
    }
  }

  autoFillNextSlot(): void {
    this.clashWarning = null;

    // 1. Next Unassigned Subject
    const unassignedSubj = this.displaySubjects.find(s => !this.isSubjectAssigned(s.name)) || this.displaySubjects[0];
    if (unassignedSubj) {
      this.newSubject = unassignedSubj.name;
    }

    // 2. Next Unassigned Period Slot
    const unassignedPeriod = this.presetPeriods.find(p => !this.isPeriodAssigned(p.slot)) || this.presetPeriods[0];
    if (unassignedPeriod) {
      this.selectedTimeSlot = unassignedPeriod.slot;
    }

    // 3. Faculty: If subject's curriculum teacher is available, use them; otherwise pick first available teacher!
    if (unassignedSubj?.teacherId && !this.isTeacherClashed(unassignedSubj.teacherId)) {
      this.selectedTeacherId = unassignedSubj.teacherId;
    } else {
      this.pickFirstAvailableTeacher();
    }
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    if (this.showAddForm && !this.editingPeriodId) {
      this.autoFillNextSlot();
    }
  }

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
    this.updateDisplaySubjects();
    this.loadRoutine();
    this.loadPeriodSlots();
    this.loadAllSchoolRoutines();
    this.loadClassSubjects();
    if (this.data.classTeacherId && this.classTeacherObj) {
      this.selectedTeacherId = this.data.classTeacherId;
    } else {
      this.selectedTeacherId = '';
    }
  }

  loadPeriodSlots(): void {
    const branchId = this.data.branchId || null;
    this.schoolService.getPeriodSlots(branchId, true).subscribe({
      next: (slots) => {
        if (slots && slots.length > 0) {
          const teachingSlots = slots
            .filter(s => !s.isBreak)
            .map(s => ({
              name: s.name,
              slot: s.timeSlot,
              isBreak: s.isBreak
            }));

          if (teachingSlots.length > 0) {
            this.presetPeriods = teachingSlots;

            if (!this.editingPeriodId) {
              const unassignedPeriod = this.presetPeriods.find(p => !this.isPeriodAssigned(p.slot)) || this.presetPeriods[0];
              this.selectedTimeSlot = unassignedPeriod.slot;
            }
          }
        }
      },
      error: () => {}
    });
  }

  loadAllSchoolRoutines(): void {
    this.schoolService.getAllSectionRoutines().subscribe({
      next: (routines) => {
        if (routines && routines.length > 0) {
          this.allSchoolRoutines = routines;
          this.autoSelectFreeSlotIfEmpty();
        } else {
          this.fallbackLoadAllRoutines();
        }
      },
      error: () => {
        this.fallbackLoadAllRoutines();
      }
    });
  }

  fallbackLoadAllRoutines(): void {
    this.schoolService.getClasses(false).subscribe({
      next: (classes) => {
        const sections: { id: string; className: string; secName: string }[] = [];
        (classes || []).forEach(c => {
          (c.sections || []).forEach(s => {
            sections.push({ id: s.id, className: c.name, secName: s.name });
          });
        });

        if (sections.length === 0) {
          this.allSchoolRoutines = [];
          return;
        }

        forkJoin(
          sections.map(sec => 
            this.schoolService.getSectionRoutine(sec.id).pipe(
              map(arr => (arr || []).map(r => ({
                ...r,
                className: r.className || sec.className,
                sectionName: r.sectionName || sec.secName
              }))),
              catchError(() => of([]))
            )
          )
        ).subscribe(results => {
          this.allSchoolRoutines = results.flat();
          this.autoSelectFreeSlotIfEmpty();
        });
      },
      error: () => {
        this.allSchoolRoutines = [];
      }
    });
  }

  autoSelectFreeSlotIfEmpty(): void {
    if (!this.editingPeriodId) {
      if (!this.selectedTeacherId || this.isTeacherClashed(this.selectedTeacherId)) {
        this.pickFirstAvailableTeacher();
      }
    }
  }

  loadClassSubjects(): void {
    if (!this.data.classId) {
      this.updateDisplaySubjects();
      return;
    }
    this.loadingClassSubjects = true;
    this.subjectsService.getClassSubjects(this.data.classId).subscribe({
      next: (subs) => {
        this.loadingClassSubjects = false;
        this.classSubjects = subs || [];
        this.updateDisplaySubjects();
      },
      error: () => {
        this.loadingClassSubjects = false;
        this.classSubjects = [];
        this.updateDisplaySubjects();
      }
    });
  }

  loadRoutine() {
    this.loading = true;
    this.schoolService.getSectionRoutine(this.data.sectionId).subscribe({
      next: (res) => {
        this.routine = res || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get classTeacherFirstName(): string {
    return this.data.classTeacherName ? this.data.classTeacherName.split(' ')[0] : 'Class Teacher';
  }

  get classTeacherObj(): TeacherDto | undefined {
    if (!this.data.classTeacherId) return undefined;
    const ct = this.data.teachers.find(t => t.id === this.data.classTeacherId);
    return (ct && this.isTeachingStaff(ct)) ? ct : undefined;
  }

  get nonCtTeachers(): TeacherDto[] {
    const list = (this.data.teachers || []).filter(t => t.isActive && this.isTeachingStaff(t));
    if (!this.data.classTeacherId) return list;
    return list.filter(t => t.id !== this.data.classTeacherId);
  }

  get uniqueSubjects(): string[] {
    const s = new Set<string>();
    this.routine.forEach(r => s.add(r.subject));
    return Array.from(s);
  }

  get isClassTeacherAssignedToPeriod(): boolean {
    if (!this.data.classTeacherId) return false;
    return this.routine.some(r => r.teacherId === this.data.classTeacherId);
  }

  quickPickClassTeacher() {
    if (this.data.classTeacherId) {
      this.selectedTeacherId = this.data.classTeacherId;
      this.showAddForm = true;
    }
  }

  isDaySelected(day: string): boolean {
    return this.selectedDays.includes(day);
  }

  toggleDay(day: string) {
    if (this.selectedDays.includes(day)) {
      this.selectedDays = this.selectedDays.filter(d => d !== day);
    } else {
      this.selectedDays = [...this.selectedDays, day];
    }
  }

  setAllDays() {
    this.selectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  }

  setWeekdays() {
    this.selectedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  }

  setAltDays() {
    this.selectedDays = ['Mon', 'Wed', 'Fri'];
  }

  getDaysArray(daysStr?: string): string[] {
    if (!daysStr) return [];
    return daysStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  editPeriod(item: SectionPeriodRoutineDto) {
    this.editingPeriodId = item.id;
    this.newSubject = item.subject;
    this.selectedTeacherId = item.teacherId;
    this.selectedTimeSlot = item.timeSlot || '08:00 AM - 08:45 AM';
    this.selectedDays = this.getDaysArray(item.daysOfWeek);
    this.clashWarning = null;
    this.showAddForm = true;
  }

  resetForm() {
    this.newSubject = '';
    this.editingPeriodId = null;
    this.clashWarning = null;
    this.showAddForm = false;
  }

  submitPeriod(allowOverride: boolean = false) {
    if (!this.newSubject.trim()) {
      this.confirmDialog.alert('Subject Required (विषय आवश्यक)', 'कृपया विषय (Subject) चुनें या नाम टाइप करें।', 'warning');
      return;
    }
    if (!this.selectedTeacherId) {
      this.confirmDialog.alert('Teacher Required (अध्यापक आवश्यक)', 'कृपया अध्यापक (Faculty Member) का चयन करें।', 'warning');
      return;
    }
    if (this.selectedDays.length === 0) {
      this.confirmDialog.alert('Days Required (दिन आवश्यक)', 'कृपया कम से कम एक दिन (Scheduled Days) चुनें।', 'warning');
      return;
    }
    if (!this.selectedTimeSlot.trim()) {
      this.confirmDialog.alert('Timing Required (समय आवश्यक)', 'कृपया Period / Timing Slot चुनें।', 'warning');
      return;
    }

    // 1. Conflict Check in the same section (exclude the one currently being edited)
    const normalizeSlot = (s?: string) => (s || '').replace(/[\u2010-\u2015\u2212–—]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizeDay = (d: string) => d.trim().substring(0, 3).toLowerCase();

    const selectedSlotNorm = normalizeSlot(this.selectedTimeSlot);
    const selectedDaysNorm = this.selectedDays.map(normalizeDay);

    const sameSectionClash = this.routine.find(p => {
      if (this.editingPeriodId && p.id === this.editingPeriodId) return false;
      const pSlotNorm = normalizeSlot(p.timeSlot);
      if (pSlotNorm !== selectedSlotNorm) return false;

      const pDays = this.getDaysArray(p.daysOfWeek).map(normalizeDay);
      return selectedDaysNorm.some(d => pDays.includes(d));
    });

    if (sameSectionClash && !allowOverride) {
      const isDiffTeacher = sameSectionClash.teacherId !== this.selectedTeacherId;
      if (isDiffTeacher) {
        const newTeacher = (this.data.teachers || []).find(t => t.id === this.selectedTeacherId);
        const newTeacherName = newTeacher?.fullName || 'New Faculty';

        this.confirmDialog.confirm(
          'Slot Conflict: Replace Faculty? (अध्यापक बदलें)',
          `इस Class में इस समय (${sameSectionClash.timeSlot || this.selectedTimeSlot}) पर पहले से ${sameSectionClash.teacherName} [${sameSectionClash.subject}] पढ़ा रहे हैं।\n\nक्या आप ${sameSectionClash.teacherName} की जगह "${newTeacherName}" को इस Period में Replace (अध्यापक बदलना) करना चाहते हैं?`,
          'Yes, Replace Faculty',
          'Cancel',
          'warning'
        ).subscribe(confirmed => {
          if (confirmed) {
            this.executeSave(allowOverride, sameSectionClash.id);
          }
        });
        return;
      } else {
        const msg = `इस Class में इस समय (${sameSectionClash.timeSlot || this.selectedTimeSlot}) पर ${sameSectionClash.teacherName} पहले से ही [${sameSectionClash.subject}] पढ़ा रहे हैं।\n\nकृपया दूसरा Period / Time Slot चुनें।`;
        this.clashWarning = msg;
        this.confirmDialog.alert('Period Already Occupied (समय पहले से तय है)', msg, 'warning');
        return;
      }
    }

    this.executeSave(allowOverride);
  }

  private executeSave(allowOverride: boolean, replaceId?: string) {
    this.saving = true;
    this.clashWarning = null;

    const payload: CreateSectionPeriodRequestDto = {
      teacherId: this.selectedTeacherId,
      subject: this.newSubject.trim(),
      daysOfWeek: this.selectedDays.join(', '),
      timeSlot: this.selectedTimeSlot.trim(),
      allowClashOverride: allowOverride,
      replaceExistingAssignmentId: replaceId
    };

    if (this.editingPeriodId) {
      this.schoolService.updateSectionPeriod(this.editingPeriodId, payload).subscribe({
        next: (updated) => {
          this.saving = false;
          const idx = this.routine.findIndex(r => r.id === updated.id);
          if (idx !== -1) {
            this.routine[idx] = updated;
          } else {
            this.routine.push(updated);
          }
          const allIdx = this.allSchoolRoutines.findIndex(r => r.id === updated.id);
          if (allIdx !== -1) {
            this.allSchoolRoutines[allIdx] = updated;
          } else {
            this.allSchoolRoutines.push(updated);
          }
          this.resetForm();
        },
        error: (err) => this.handleSaveError(err)
      });
    } else {
      this.schoolService.addSectionPeriod(this.data.sectionId, payload).subscribe({
        next: (res) => {
          this.saving = false;
          const idx = this.routine.findIndex(r => r.id === res.id);
          if (idx !== -1) {
            this.routine[idx] = res;
          } else {
            this.routine.push(res);
          }
          const allIdx = this.allSchoolRoutines.findIndex(r => r.id === res.id);
          if (allIdx !== -1) {
            this.allSchoolRoutines[allIdx] = res;
          } else {
            this.allSchoolRoutines.push(res);
          }
          this.resetForm();
        },
        error: (err) => this.handleSaveError(err)
      });
    }
  }

  private handleSaveError(err: any) {
    this.saving = false;
    if (err.status === 409) {
      if (err.error?.requiresOverride) {
        this.clashWarning = err.error.message;
      } else {
        this.confirmDialog.alert(
          'Already Assigned (पहले से आवंटित)',
          err.error?.message || 'इस समय पर पहले से दूसरे अध्यापक को assign किया गया है।',
          'warning'
        );
      }
    } else if (err.status === 404) {
      this.confirmDialog.alert(
        'Backend Restart Required',
        'Backend server route not found (404). Please restart Visual Studio backend (F5) so the new routine endpoints are loaded.',
        'danger'
      );
    } else {
      this.confirmDialog.alert(
        'Assignment Error',
        err.error?.message || `Failed to save period slot (Status: ${err.status}).`,
        'danger'
      );
    }
  }

  deletePeriod(item: SectionPeriodRoutineDto) {
    this.confirmDialog.danger(
      'Remove Period',
      `Are you sure you want to remove "${item.subject}" (${item.teacherName}) from this section's weekly routine?`
    ).subscribe(ok => {
      if (!ok) return;

      this.schoolService.removeSectionPeriod(item.id).subscribe({
        next: () => {
          this.routine = this.routine.filter(r => r.id !== item.id);
          this.allSchoolRoutines = this.allSchoolRoutines.filter(r => r.id !== item.id);
        },
        error: (err) => {
          this.confirmDialog.alert('Error', err.error?.message || 'Failed to remove period.', 'danger');
        }
      });
    });
  }

  printRoutine() {
    const win = window.open('', '_blank');
    if (!win) return;

    let rowsHtml = '';
    this.routine.forEach((p, idx) => {
      rowsHtml += `
        <tr>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;"><strong>${p.timeSlot || '-'}</strong></td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1; font-weight: bold; color: #1e40af;">${p.subject}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${p.teacherName} (${p.teacherEmployeeCode}) ${p.isClassTeacher ? '<span style="color: #16a34a; font-weight: bold;">[Class Teacher]</span>' : ''}</td>
          <td style="padding: 8px 12px; border: 1px solid #cbd5e1;">${p.daysOfWeek || 'All Days'}</td>
        </tr>
      `;
    });

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Weekly Routine - ${this.data.className} ${this.data.sectionName}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 18px; }
          h2 { margin: 0; color: #1e3a8a; }
          p { margin: 4px 0; color: #475569; font-size: 0.9rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 0.88rem; }
          th { background: #eff6ff; color: #1e3a8a; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; }
          .ct-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; margin-bottom: 14px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Weekly Class Routine & Timetable</h2>
          <p><strong>${this.data.className} - ${this.data.sectionName}</strong></p>
        </div>
        <div class="ct-box">
          <strong>Class Teacher (कक्षा अध्यापक):</strong> ${this.data.classTeacherName || 'Unassigned'} 
          ${this.data.classTeacherPhone ? ' &bull; Contact: ' + this.data.classTeacherPhone : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Time Slot</th>
              <th>Subject</th>
              <th>Faculty Member</th>
              <th>Days</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 0.85rem; color: #64748b;">
          <span>Generated on: ${new Date().toLocaleDateString()}</span>
          <span>Principal / Authorized Signature</span>
        </div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  }

  onClose() {
    this.dialogRef.close({ updated: true });
  }
}
