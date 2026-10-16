import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

type HwState = 'Pending' | 'Completed' | 'Partial' | 'NotDone';

interface HwCheckDate {
  date: string;
  students: number;
  totalPoints: number;
  checkedPoints: number;
  pendingPoints: number;
}

interface HwPoint {
  subject: string;
  task: string;
  teacherName?: string | null;
  checkedByName?: string | null;
  checkedAt?: string | null;
  status: HwState;
  original: HwState;
  remark: string;
}

interface HwStudentVm {
  studentId: string;
  studentName: string;
  rollNumber: string;
  isAbsent: boolean;
  attendanceStatus: string;
  points: HwPoint[];
}

interface HwAnalyticsStudent {
  studentId: string;
  studentName: string;
  rollNumber: string;
  assigned: number;
  completed: number;
  partial: number;
  notDone: number;
  pending: number;
  absentExcused: number;
  completionPercent: number;
}

interface HwAnalyticsSubject {
  subject: string;
  assigned: number;
  completed: number;
  partial: number;
  notDone: number;
  pending: number;
  completionPercent: number;
}

interface HwAnalytics {
  from: string;
  to: string;
  summary: {
    totalPoints: number;
    completed: number;
    partial: number;
    notDone: number;
    pending: number;
    absentExcused: number;
    completionPercent: number;
    checkedPercent: number;
  };
  students: HwAnalyticsStudent[];
  subjects: HwAnalyticsSubject[];
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function displayDate(raw: string): string {
  const p = (raw || '').split('T')[0].split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : raw;
}

function weekday(raw: string): string {
  const iso = (raw || '').split('T')[0];
  const d = new Date(`${iso}T00:00:00Z`);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
}

function sectionsOf(classes: any[], classId: string): any[] {
  return classes?.find(c => c.id === classId)?.sections || [];
}

// ===========================================================================
// CHECK H.W. PANEL (next-day / back-dated checking)
// ===========================================================================
@Component({
  selector: 'app-hw-check-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule, IstDatetimeDirective
  ],
  template: `
    <div class="hwc-wrap">
      <div class="hwc-info">
        <mat-icon>fact_check</mat-icon>
        <div>
          <strong>Check H.W.</strong>
          <span>Select the date on which homework was given, then tick each point as Completed / Partial / Not Done.
            Works for same-day or next-day checking. Absent students are skipped.</span>
        </div>
      </div>

      <form [formGroup]="form" class="hwc-filters">
        <mat-form-field appearance="outline" class="hwc-field" [class.field-locked]="isClassTeacherLocked">
          <mat-label>Class</mat-label>
          <mat-select formControlName="classId" [disabled]="isClassTeacherLocked">
            <mat-option *ngFor="let c of classes" [value]="c.id" [class.ct-highlight-opt]="isClassTeacherLocked && c.id === form.getRawValue().classId">
              {{ c.name }}
              <span class="ct-pill-badge" *ngIf="isClassTeacherLocked && c.id === form.getRawValue().classId">⭐ Class Teacher</span>
            </mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="hwc-field" [class.field-locked]="isClassTeacherLocked && !!teacherAssignedSectionId">
          <mat-label>Section</mat-label>
          <mat-select formControlName="sectionId" [disabled]="isClassTeacherLocked && !!teacherAssignedSectionId">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let s of sections" [value]="s.id">{{ s.name }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="hwc-field">
          <mat-label>H.W. Given On (तारीख)</mat-label>
          <input matInput type="date" formControlName="date">
        </mat-form-field>

        <mat-form-field appearance="outline" class="hwc-field hwc-search">
          <mat-label>Search student</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput formControlName="search" placeholder="Name or roll no.">
        </mat-form-field>

        <label class="hwc-toggle">
          <input type="checkbox" formControlName="onlyPending">
          <span>Show only unchecked</span>
        </label>
      </form>

      <div class="hwc-dates" *ngIf="dates.length > 0">
        <span class="hwc-dates-label">Recent H.W. dates:</span>
        <button type="button" class="hwc-date-chip"
                *ngFor="let d of dates"
                [class.active]="isSelectedDate(d.date)"
                [class.has-pending]="d.pendingPoints > 0"
                (click)="selectDate(d.date)">
          <span class="dc-day">{{ weekdayOf(d.date) }} {{ formatDate(d.date) }}</span>
          <span class="dc-count">{{ d.checkedPoints }}/{{ d.totalPoints }} checked</span>
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <div class="hwc-kpis" *ngIf="students.length > 0">
        <div class="kpi"><span class="k-val">{{ totalPoints }}</span><span class="k-lbl">H.W. Points</span></div>
        <div class="kpi ok"><span class="k-val">{{ countBy('Completed') }}</span><span class="k-lbl">✔ Completed</span></div>
        <div class="kpi mid"><span class="k-val">{{ countBy('Partial') }}</span><span class="k-lbl">◐ Partial</span></div>
        <div class="kpi bad"><span class="k-val">{{ countBy('NotDone') }}</span><span class="k-lbl">✘ Not Done</span></div>
        <div class="kpi pend"><span class="k-val">{{ countBy('Pending') }}</span><span class="k-lbl">⏳ Unchecked</span></div>
      </div>

      <div class="hwc-actions" *ngIf="students.length > 0">
        <button mat-stroked-button type="button" (click)="markAll('Completed')">
          <mat-icon>done_all</mat-icon> Mark All Present Students ✔
        </button>
        <button mat-stroked-button type="button" (click)="markAllPendingAs('Completed')" matTooltip="Marks only the unchecked points as Completed">
          <mat-icon>playlist_add_check</mat-icon> Unchecked → ✔
        </button>
        <button mat-stroked-button type="button" (click)="resetChanges()" [disabled]="changedCount === 0">
          <mat-icon>undo</mat-icon> Undo Changes
        </button>
        <span class="spacer"></span>
        <span class="hwc-dirty" *ngIf="changedCount > 0">{{ changedCount }} unsaved change(s)</span>
        <button mat-stroked-button class="hwc-print" type="button" (click)="openReportDialog()" matTooltip="Print or WhatsApp Share Report (with ticks & verification)">
          <mat-icon>print</mat-icon>
          <span>Print / WhatsApp Report</span>
        </button>
        <button mat-raised-button class="hwc-save" type="button" (click)="save()" [disabled]="saving || changedCount === 0">
          <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : 'Save H.W. Status' }}
        </button>
      </div>

      <div class="hwc-empty" *ngIf="!loading && students.length === 0">
        <mat-icon>inbox</mat-icon>
        <p>{{ emptyMessage }}</p>
      </div>

      <div class="hwc-student-list">
        <div class="hwc-student" *ngFor="let s of visibleStudents" [class.absent]="s.isAbsent">
          <div class="hs-head">
            <div class="hs-id">
              <span class="hs-roll" *ngIf="s.rollNumber">{{ s.rollNumber }}</span>
              <span class="hs-name">{{ s.studentName }}</span>
              <span class="hs-badge absent" *ngIf="s.isAbsent">Absent – skipped</span>
              <span class="hs-badge done" *ngIf="!s.isAbsent && studentScore(s) as sc">{{ sc }}</span>
            </div>
            <div class="hs-quick" *ngIf="!s.isAbsent">
              <button type="button" class="q-btn ok" (click)="setStudent(s, 'Completed')" matTooltip="All points Completed">✔ All</button>
              <button type="button" class="q-btn bad" (click)="setStudent(s, 'NotDone')" matTooltip="All points Not Done">✘ All</button>
            </div>
          </div>

          <div class="hs-point" *ngFor="let p of s.points" [class.changed]="p.status !== p.original">
            <div class="hp-text">
              <span class="hp-subject">{{ p.subject || 'General' }}</span>
              <span class="hp-task">{{ p.task }}</span>
              <span class="hp-meta" *ngIf="p.teacherName">Assigned by {{ p.teacherName }}</span>
              <span class="hp-meta" *ngIf="p.checkedByName && p.status !== 'Pending'">
                • Checked by {{ p.checkedByName }}
                <span [appIstDatetime]="p.checkedAt || ''" format="shortDatetime"></span>
              </span>
            </div>
            <div class="hp-controls">
              <button type="button" class="st-btn ok" [class.on]="p.status === 'Completed'" [disabled]="s.isAbsent"
                      (click)="toggle(p, 'Completed')" matTooltip="Completed">✔</button>
              <button type="button" class="st-btn mid" [class.on]="p.status === 'Partial'" [disabled]="s.isAbsent"
                      (click)="toggle(p, 'Partial')" matTooltip="Partial">◐</button>
              <button type="button" class="st-btn bad" [class.on]="p.status === 'NotDone'" [disabled]="s.isAbsent"
                      (click)="toggle(p, 'NotDone')" matTooltip="Not Done">✘</button>
              <div class="hp-remark-group" *ngIf="p.status === 'Partial' || p.status === 'NotDone'">
                <div class="hw-badges-wrap">
                  <button type="button"
                          *ngFor="let b of getBadgesForState(p.status)"
                          class="hw-badge-chip"
                          [class.active-bad]="p.status === 'NotDone' && isBadgeActive(p, b.label)"
                          [class.active-mid]="p.status === 'Partial' && isBadgeActive(p, b.label)"
                          (click)="selectBadgeRemark(p, b.label)">
                    <span class="b-icon">{{ b.icon }}</span>
                    <span class="b-text">{{ b.label }}</span>
                  </button>
                </div>
                <input class="hp-custom-remark" type="text" maxlength="150" placeholder="Other note..."
                       [value]="p.remark" (input)="p.remark = $any($event.target).value"
                       matTooltip="Optional custom note">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .hwc-wrap { display: flex; flex-direction: column; gap: 14px; }
    .hwc-info { display: flex; gap: 12px; align-items: flex-start; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; color: #1e3a8a; }
    .hwc-info mat-icon { background: #2563eb; color: #fff; border-radius: 10px; padding: 8px; box-sizing: content-box; width: 22px; height: 22px; font-size: 22px; }
    .hwc-info strong { display: block; font-size: 15px; }
    .hwc-info span { font-size: 12.5px; color: #3b82f6; }
    .hwc-filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 14px 0; }
    .hwc-field { flex: 1 1 180px; min-width: 160px; }
    .hwc-search { flex: 2 1 220px; }
    .hwc-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #334155; margin-bottom: 18px; cursor: pointer; }
    .hwc-dates { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .hwc-dates-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .hwc-date-chip { display: flex; flex-direction: column; align-items: flex-start; border: 1px solid #cbd5e1; background: #fff; border-radius: 10px;
      padding: 6px 12px; cursor: pointer; transition: all .15s; font-family: inherit; }
    .hwc-date-chip:hover { border-color: #3b82f6; box-shadow: 0 2px 8px rgba(37,99,235,.15); }
    .hwc-date-chip.active { background: #2563eb; border-color: #2563eb; }
    .hwc-date-chip.active .dc-day, .hwc-date-chip.active .dc-count { color: #fff; }
    .hwc-date-chip.has-pending:not(.active) { border-color: #f59e0b; background: #fffbeb; }
    .dc-day { font-size: 13px; font-weight: 700; color: #0f172a; }
    .dc-count { font-size: 11px; color: #64748b; }
    .hwc-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
    .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; }
    .kpi .k-val { font-size: 22px; font-weight: 800; color: #0f172a; }
    .kpi .k-lbl { font-size: 12px; color: #64748b; font-weight: 600; }
    .kpi.ok .k-val { color: #16a34a; } .kpi.mid .k-val { color: #d97706; } .kpi.bad .k-val { color: #dc2626; } .kpi.pend .k-val { color: #64748b; }
    .hwc-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .hwc-actions .spacer { flex: 1; }
    .hwc-dirty { font-size: 12.5px; font-weight: 700; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 4px 12px; }
    .hwc-print { border-color: #2563eb !important; color: #1e40af !important; background: #eff6ff !important; font-weight: 700; }
    .hwc-print:hover { background: #dbeafe !important; }
    .hwc-print mat-icon { color: #2563eb; }
    .hwc-save { background: #2563eb !important; color: #fff !important; }
    .hwc-empty { text-align: center; padding: 36px 12px; color: #64748b; background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; }
    .hwc-empty mat-icon { font-size: 40px; width: 40px; height: 40px; color: #94a3b8; }
    .hwc-student-list { display: flex; flex-direction: column; gap: 12px; }
    .hwc-student { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .hwc-student.absent { opacity: .6; background: #f8fafc; }
    .hs-head { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: center; padding: 10px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .hs-id { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .hs-roll { background: #dbeafe; color: #1e40af; font-weight: 800; font-size: 12px; border-radius: 6px; padding: 2px 8px; }
    .hs-name { font-weight: 700; color: #0f172a; }
    .hs-badge { font-size: 11px; font-weight: 700; border-radius: 999px; padding: 2px 10px; }
    .hs-badge.absent { background: #fee2e2; color: #b91c1c; }
    .hs-badge.done { background: #dcfce7; color: #166534; }
    .hs-quick { display: flex; gap: 6px; }
    .q-btn { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .q-btn.ok:hover { background: #dcfce7; border-color: #16a34a; } .q-btn.bad:hover { background: #fee2e2; border-color: #dc2626; }
    .hs-point { display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
    .hs-point:last-child { border-bottom: none; }
    .hs-point.changed { background: #fffbeb; }
    .hp-text { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: baseline; flex: 1 1 260px; min-width: 0; }
    .hp-subject { background: #e0e7ff; color: #3730a3; font-size: 11px; font-weight: 800; border-radius: 6px; padding: 2px 8px; text-transform: uppercase; }
    .hp-task { font-size: 14px; color: #0f172a; font-weight: 600; word-break: break-word; }
    .hp-meta { font-size: 11.5px; color: #64748b; }
    .hp-controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .st-btn { width: 38px; height: 34px; border-radius: 8px; border: 1px solid #cbd5e1; background: #fff; font-size: 16px; font-weight: 800; cursor: pointer; transition: all .12s; font-family: inherit; }
    .st-btn:disabled { cursor: not-allowed; opacity: .45; }
    .st-btn.ok { color: #16a34a; } .st-btn.mid { color: #d97706; } .st-btn.bad { color: #dc2626; }
    .st-btn.ok.on { background: #16a34a; color: #fff; border-color: #16a34a; }
    .st-btn.mid.on { background: #f59e0b; color: #fff; border-color: #f59e0b; }
    .st-btn.bad.on { background: #dc2626; color: #fff; border-color: #dc2626; }
    .hp-remark-group { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .hw-badges-wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; }
    .hw-badge-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      transition: all .15s ease;
      font-family: inherit;
      white-space: nowrap;
    }
    .hw-badge-chip:hover {
      border-color: #94a3b8;
      background: #f8fafc;
      transform: translateY(-1px);
    }
    .hw-badge-chip.active-bad {
      background: #fee2e2;
      border-color: #ef4444;
      color: #b91c1c;
      box-shadow: 0 1px 3px rgba(239, 68, 68, 0.2);
    }
    .hw-badge-chip.active-mid {
      background: #fef3c7;
      border-color: #f59e0b;
      color: #b45309;
      box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
    }
    .b-icon { font-size: 12px; }
    .hp-custom-remark {
      height: 30px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 11.5px;
      width: 100px;
      font-family: inherit;
      transition: width .2s, border-color .15s;
    }
    .hp-custom-remark:focus {
      width: 150px;
      border-color: #2563eb;
      outline: none;
    }
    .field-locked { opacity: 0.95; }
    .field-locked ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f1f5f9 !important;
      cursor: not-allowed !important;
    }
    .field-locked ::ng-deep .mat-mdc-select-value {
      font-weight: 700 !important;
      color: #1e3a8a !important;
    }
    .ct-highlight-opt {
      font-weight: 700 !important;
      color: #1d4ed8 !important;
      background: #eff6ff !important;
    }
    .ct-pill-badge {
      font-size: 10px;
      font-weight: 700;
      color: #1e40af;
      background: #dbeafe;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 1px 7px;
      margin-left: 6px;
    }
    @media (max-width: 1024px) {
      .hwc-kpis { grid-template-columns: repeat(2, 1fr); }
      .hwc-filters { padding: 12px; gap: 10px; }
      .hwc-field { flex: 1 1 calc(50% - 10px); min-width: 140px; }
      .hwc-search { flex: 1 1 100%; }
      .hwc-actions { gap: 8px; }
    }
    @media (max-width: 640px) {
      .hwc-kpis { grid-template-columns: 1fr; }
      .hwc-filters { flex-direction: column; align-items: stretch; padding: 12px; gap: 8px; }
      .hwc-field { width: 100%; min-width: 0; }
      .hwc-search { width: 100%; }
      .hwc-toggle { width: 100%; margin-bottom: 8px; }
      .hwc-dates { gap: 6px; }
      .hwc-date-chip { width: 100%; }
      .hwc-actions { flex-direction: column; align-items: stretch; gap: 8px; }
      .hwc-actions button { width: 100%; justify-content: center; }
      .hwc-actions .spacer { display: none; }
      .hwc-dirty { text-align: center; }
      .hs-head { flex-direction: column; align-items: flex-start; gap: 10px; }
      .hs-id { width: 100%; }
      .hs-quick { width: 100%; justify-content: flex-start; gap: 8px; }
      .hs-quick button { flex: 1; text-align: center; }
      .hs-point { flex-direction: column; align-items: flex-start; gap: 8px; }
      .hp-text { width: 100%; }
      .hp-controls { width: 100%; justify-content: flex-start; gap: 8px; }
      .hp-remark-group { width: 100%; }
      .hw-badges-wrap { width: 100%; }
      .hp-custom-remark { width: 100%; }
    }
  `]
})
export class HwCheckPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() classes: any[] = [];
  @Input() classId = '';
  @Input() sectionId = '';
  @Input() isClassTeacherLocked = false;
  @Input() teacherAssignedSectionId = '';
  @Output() saved = new EventEmitter<void>();
  @Output() openReport = new EventEmitter<{ classId: string; sectionId: string; date: string }>();

  form: FormGroup;
  sections: any[] = [];
  dates: HwCheckDate[] = [];
  students: HwStudentVm[] = [];
  loading = false;
  saving = false;
  emptyMessage = 'Select a class to start checking homework.';
  private subs = new Subscription();

  constructor(private fb: FormBuilder, private http: HttpClient, private confirmDialog: ConfirmDialogService) {
    this.form = this.fb.group({
      classId: [''],
      sectionId: [''],
      date: [localDateString(new Date())],
      search: [''],
      onlyPending: [false]
    });
  }

  ngOnInit(): void {
    this.subs.add(this.form.get('classId')!.valueChanges.subscribe(v => {
      this.sections = sectionsOf(this.classes, v);
      this.form.get('sectionId')!.setValue('', { emitEvent: false });
      this.loadDates(true);
    }));
    this.subs.add(this.form.get('sectionId')!.valueChanges.subscribe(() => this.loadDates(true)));
    this.subs.add(this.form.get('date')!.valueChanges.subscribe(() => this.loadRows()));
    this.syncFromInputs();
    this.applyClassTeacherLock();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['classId'] || changes['sectionId'] || changes['classes'] || changes['isClassTeacherLocked'] || changes['teacherAssignedSectionId']) && this.form) {
      this.syncFromInputs();
      this.applyClassTeacherLock();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private applyClassTeacherLock(): void {
    if (!this.form) return;
    if (this.isClassTeacherLocked) {
      this.form.get('classId')?.disable({ emitEvent: false });
      if (this.teacherAssignedSectionId) {
        this.form.get('sectionId')?.disable({ emitEvent: false });
      } else {
        this.form.get('sectionId')?.enable({ emitEvent: false });
      }
    } else {
      this.form.get('classId')?.enable({ emitEvent: false });
      this.form.get('sectionId')?.enable({ emitEvent: false });
    }
  }

  private syncFromInputs(): void {
    const raw = this.form.getRawValue();
    const cid = this.classId || raw.classId || (this.classes[0]?.id ?? '');
    if (!cid) return;
    const changedClass = cid !== raw.classId;
    const sid = changedClass || this.sectionId !== raw.sectionId ? (this.sectionId || '') : raw.sectionId;
    this.sections = sectionsOf(this.classes, cid);
    if (changedClass || sid !== raw.sectionId) {
      this.form.patchValue({ classId: cid, sectionId: sid }, { emitEvent: false });
      this.loadDates(true);
    }
    this.applyClassTeacherLock();
  }

  get changedCount(): number {
    return this.students.reduce((n, s) => n + s.points.filter(p => p.status !== p.original).length, 0);
  }

  get totalPoints(): number {
    return this.students.reduce((n, s) => n + s.points.length, 0);
  }

  get visibleStudents(): HwStudentVm[] {
    const raw = this.form.getRawValue();
    const term = (raw.search || '').toString().trim().toLowerCase();
    const onlyPending = !!raw.onlyPending;
    return this.students.filter(s => {
      if (term && !(`${s.studentName} ${s.rollNumber}`.toLowerCase().includes(term))) return false;
      if (onlyPending && !s.points.some(p => p.status === 'Pending')) return false;
      return true;
    });
  }

  countBy(state: HwState): number {
    return this.students.reduce((n, s) => n + (s.isAbsent ? 0 : s.points.filter(p => p.status === state).length), 0);
  }

  formatDate = displayDate;
  weekdayOf = weekday;

  isSelectedDate(d: string): boolean {
    return (d || '').split('T')[0] === this.form.getRawValue().date;
  }

  selectDate(d: string): void {
    this.form.get('date')!.setValue((d || '').split('T')[0]);
  }

  studentScore(s: HwStudentVm): string | null {
    const checked = s.points.filter(p => p.status !== 'Pending');
    if (checked.length === 0) return null;
    const done = checked.reduce((n, p) => n + (p.status === 'Completed' ? 1 : p.status === 'Partial' ? 0.5 : 0), 0);
    return `Done ${done} / ${s.points.length}`;
  }

  private query(): string {
    const v = this.form.getRawValue();
    let q = `classId=${v.classId}`;
    if (v.sectionId) q += `&sectionId=${v.sectionId}`;
    return q;
  }

  loadDates(reloadRows: boolean): void {
    const v = this.form.getRawValue();
    if (!v.classId) return;
    this.loading = true;
    this.http.get<HwCheckDate[]>(`${API_BASE}/homework/daily-diary/hw-dates?${this.query()}&days=30`).subscribe({
      next: list => {
        this.dates = list || [];
        if (reloadRows) {
          const current = (this.form.getRawValue().date || '') as string;
          const hasCurrent = this.dates.some(d => d.date.split('T')[0] === current);
          if (!hasCurrent && this.dates.length > 0) {
            const firstPending = this.dates.find(d => d.pendingPoints > 0) || this.dates[0];
            this.form.get('date')!.setValue(firstPending.date.split('T')[0], { emitEvent: false });
          }
          this.loadRows();
        } else {
          this.loading = false;
        }
      },
      error: () => {
        this.dates = [];
        this.students = [];
        this.loading = false;
        this.emptyMessage = 'Could not load homework dates. Please try again.';
      }
    });
  }

  loadRows(): void {
    const v = this.form.getRawValue();
    if (!v.classId || !v.date) return;
    this.loading = true;
    this.http.get<any[]>(`${API_BASE}/homework/daily-diary?date=${v.date}&${this.query()}`).subscribe({
      next: rows => {
        this.students = (rows || [])
          .map(r => {
            const att = (r.attendanceStatus || '').toLowerCase();
            const points: HwPoint[] = (r.homeWork || [])
              .filter((h: any) => h.task && h.task.trim().length > 0)
              .map((h: any) => ({
                subject: h.subject,
                task: h.task,
                teacherName: h.teacherName,
                checkedByName: h.checkedByName,
                checkedAt: h.checkedAt,
                status: (h.status || 'Pending') as HwState,
                original: (h.status || 'Pending') as HwState,
                remark: h.statusRemark || ''
              }));
            return {
              studentId: r.studentId,
              studentName: r.studentName,
              rollNumber: r.rollNumber || '',
              isAbsent: !!r.isAbsent || att === 'absent' || att === 'leave',
              attendanceStatus: r.attendanceStatus || '',
              points
            } as HwStudentVm;
          })
          .filter(s => s.points.length > 0);
        this.emptyMessage = this.students.length === 0
          ? `No homework was assigned on ${displayDate(v.date)} for this class. Pick another date above.`
          : '';
        this.loading = false;
      },
      error: () => {
        this.students = [];
        this.emptyMessage = 'Could not load students. Please try again.';
        this.loading = false;
      }
    });
  }

  notDoneBadges = [
    { icon: '📚', label: 'Incomplete' },
    { icon: '✘', label: 'Not Done' },
    { icon: '📓', label: 'No Notebook' },
    { icon: '🏠', label: 'Forgot at Home' }
  ];

  partialBadges = [
    { icon: '◐', label: 'Half Done' },
    { icon: '📝', label: 'Needs Practice' },
    { icon: '✍️', label: 'Handwriting' },
    { icon: '⏳', label: 'Late' }
  ];

  getBadgesForState(state: HwState): { icon: string; label: string }[] {
    return state === 'NotDone' ? this.notDoneBadges : this.partialBadges;
  }

  isBadgeActive(p: HwPoint, label: string): boolean {
    if (!p.remark) return false;
    const r = p.remark.trim().toLowerCase();
    const l = label.trim().toLowerCase();
    if (r === l) return true;
    if (l === 'incomplete' && (r === 'not complete' || r === 'not completed')) return true;
    return false;
  }

  selectBadgeRemark(p: HwPoint, label: string): void {
    if (this.isBadgeActive(p, label)) {
      p.remark = '';
    } else {
      p.remark = label;
    }
  }

  toggle(p: HwPoint, state: HwState): void {
    const nextState = p.status === state ? 'Pending' : state;
    p.status = nextState;
    if (nextState === 'Completed' || nextState === 'Pending') {
      p.remark = '';
    } else if (nextState === 'NotDone') {
      p.remark = 'Incomplete';
    } else if (nextState === 'Partial') {
      p.remark = 'Half Done';
    }
  }

  setStudent(s: HwStudentVm, state: HwState): void {
    if (s.isAbsent) return;
    for (const p of s.points) {
      p.status = state;
      if (state === 'Completed' || state === 'Pending') {
        p.remark = '';
      } else if (state === 'NotDone') {
        p.remark = 'Incomplete';
      } else if (state === 'Partial') {
        p.remark = 'Half Done';
      }
    }
  }

  markAll(state: HwState): void {
    for (const s of this.visibleStudents) this.setStudent(s, state);
  }

  markAllPendingAs(state: HwState): void {
    for (const s of this.visibleStudents) {
      if (s.isAbsent) continue;
      for (const p of s.points) {
        if (p.status === 'Pending') {
          p.status = state;
          if (state === 'NotDone') p.remark = 'Incomplete';
          else if (state === 'Partial') p.remark = 'Half Done';
        }
      }
    }
  }

  resetChanges(): void {
    for (const s of this.students) {
      for (const p of s.points) {
        if (p.status !== p.original) {
          p.status = p.original;
        }
      }
    }
  }

  save(): void {
    const v = this.form.getRawValue();
    const items: any[] = [];
    for (const s of this.students) {
      if (s.isAbsent) continue;
      for (const p of s.points) {
        if (p.status !== p.original || (p.status !== 'Pending' && p.remark)) {
          items.push({ studentId: s.studentId, subject: p.subject, task: p.task, status: p.status, remark: p.remark || null });
        }
      }
    }
    if (items.length === 0) {
      this.confirmDialog.alert('Nothing to Save', 'You have not changed any homework status yet.', 'info');
      return;
    }
    this.saving = true;
    this.http.post<{ updated: number; skipped: number; message: string }>(`${API_BASE}/homework/daily-diary/hw-status`, {
      diaryDate: v.date,
      classId: v.classId || null,
      sectionId: v.sectionId || null,
      items
    }).subscribe({
      next: res => {
        this.saving = false;
        this.confirmDialog.alert('H.W. Status Saved', res?.message || 'Homework status saved successfully.', res?.skipped ? 'warning' : 'success');
        this.saved.emit();
        this.loadDates(true);
      },
      error: err => {
        this.saving = false;
        this.confirmDialog.alert('Could Not Save', err?.error?.message || 'You are not permitted to update this homework status, or the request failed.', 'danger');
      }
    });
  }

  openReportDialog(): void {
    const v = this.form.getRawValue();
    this.openReport.emit({
      classId: v.classId || this.classId,
      sectionId: v.sectionId || this.sectionId || '',
      date: v.date || localDateString(new Date())
    });
  }
}

// ===========================================================================
// H.W. ANALYTICS PANEL
// ===========================================================================
@Component({
  selector: 'app-hw-analytics-panel',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule
  ],
  template: `
    <div class="hwa-wrap">
      <div class="hwa-info">
        <mat-icon>insights</mat-icon>
        <div>
          <strong>Homework Completion &amp; Defaulter Analytics</strong>
          <span>Student-wise and subject-wise homework completion for any period. Absent days are excluded from the score.</span>
        </div>
      </div>

      <form [formGroup]="form" class="hwa-filters">
        <mat-form-field appearance="outline" class="hwa-field" [class.field-locked]="isClassTeacherLocked">
          <mat-label>Class</mat-label>
          <mat-select formControlName="classId" [disabled]="isClassTeacherLocked">
            <mat-option *ngFor="let c of classes" [value]="c.id" [class.ct-highlight-opt]="isClassTeacherLocked && c.id === form.getRawValue().classId">
              {{ c.name }}
              <span class="ct-pill-badge" *ngIf="isClassTeacherLocked && c.id === form.getRawValue().classId">⭐ Class Teacher</span>
            </mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="hwa-field" [class.field-locked]="isClassTeacherLocked && !!teacherAssignedSectionId">
          <mat-label>Section</mat-label>
          <mat-select formControlName="sectionId" [disabled]="isClassTeacherLocked && !!teacherAssignedSectionId">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let s of sections" [value]="s.id">{{ s.name }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="hwa-field">
          <mat-label>From</mat-label>
          <input matInput type="date" formControlName="from">
        </mat-form-field>
        <mat-form-field appearance="outline" class="hwa-field">
          <mat-label>To</mat-label>
          <input matInput type="date" formControlName="to">
        </mat-form-field>
        <mat-form-field appearance="outline" class="hwa-field">
          <mat-label>Sort students</mat-label>
          <mat-select formControlName="sort">
            <mat-option value="roll">Roll number</mat-option>
            <mat-option value="lowest">Lowest completion first</mat-option>
            <mat-option value="highest">Highest completion first</mat-option>
          </mat-select>
        </mat-form-field>
      </form>

      <div class="hwa-presets">
        <button mat-stroked-button type="button" (click)="preset(7)">Last 7 days</button>
        <button mat-stroked-button type="button" (click)="preset(30)">Last 30 days</button>
        <button mat-stroked-button type="button" (click)="presetMonth()">This month</button>
        <span class="spacer"></span>
        <button mat-stroked-button type="button" (click)="exportCsv()" [disabled]="!data || data.students.length === 0">
          <mat-icon>download</mat-icon> Export CSV
        </button>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <ng-container *ngIf="data as d">
        <div class="hwa-kpis">
          <div class="kpi"><span class="k-val">{{ d.summary.totalPoints }}</span><span class="k-lbl">Points Assigned</span></div>
          <div class="kpi ok"><span class="k-val">{{ d.summary.completed }}</span><span class="k-lbl">✔ Completed</span></div>
          <div class="kpi mid"><span class="k-val">{{ d.summary.partial }}</span><span class="k-lbl">◐ Partial</span></div>
          <div class="kpi bad"><span class="k-val">{{ d.summary.notDone }}</span><span class="k-lbl">✘ Not Done</span></div>
          <div class="kpi pend"><span class="k-val">{{ d.summary.pending }}</span><span class="k-lbl">⏳ Unchecked</span></div>
          <div class="kpi blue"><span class="k-val">{{ d.summary.completionPercent }}%</span><span class="k-lbl">Completion Rate</span></div>
          <div class="kpi blue"><span class="k-val">{{ d.summary.checkedPercent }}%</span><span class="k-lbl">Checked Rate</span></div>
        </div>

        <div class="hwa-card" *ngIf="d.subjects.length > 0">
          <div class="hwa-card-title"><mat-icon>menu_book</mat-icon> Subject-wise</div>
          <div class="table-responsive">
            <table class="hwa-table">
              <thead><tr>
                <th>Subject</th><th>Assigned</th><th>✔</th><th>◐</th><th>✘</th><th>⏳</th><th style="min-width:180px">Completion</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let s of d.subjects">
                  <td class="strong">{{ s.subject }}</td>
                  <td>{{ s.assigned }}</td><td>{{ s.completed }}</td><td>{{ s.partial }}</td><td>{{ s.notDone }}</td><td>{{ s.pending }}</td>
                  <td>
                    <div class="bar"><div class="fill" [style.width.%]="s.completionPercent" [ngClass]="band(s.completionPercent)"></div></div>
                    <span class="pct">{{ s.completionPercent }}%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="hwa-card">
          <div class="hwa-card-title"><mat-icon>groups</mat-icon> Student-wise
            <span class="hwa-chip warn" *ngIf="defaulterCount > 0">{{ defaulterCount }} need attention (&lt; 50%)</span>
          </div>
          <div class="table-responsive">
            <table class="hwa-table">
              <thead><tr>
                <th>#</th><th>Roll</th><th>Student</th><th>Assigned</th><th>✔</th><th>◐</th><th>✘</th><th>⏳</th><th>Absent</th>
                <th style="min-width:200px">Completion</th>
              </tr></thead>
              <tbody>
                <tr *ngFor="let s of sortedStudents; let i = index" [class.alert-row]="isDefaulter(s)">
                  <td>{{ i + 1 }}</td>
                  <td>{{ s.rollNumber }}</td>
                  <td class="strong">{{ s.studentName }}</td>
                  <td>{{ s.assigned }}</td><td>{{ s.completed }}</td><td>{{ s.partial }}</td><td>{{ s.notDone }}</td><td>{{ s.pending }}</td><td>{{ s.absentExcused }}</td>
                  <td>
                    <div class="bar"><div class="fill" [style.width.%]="s.completionPercent" [ngClass]="band(s.completionPercent)"></div></div>
                    <span class="pct">{{ s.completionPercent }}%</span>
                  </td>
                </tr>
                <tr *ngIf="d.students.length === 0"><td colspan="10" class="empty-cell">No homework found for the selected period.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .hwa-wrap { display: flex; flex-direction: column; gap: 14px; }
    .hwa-info { display: flex; gap: 12px; align-items: flex-start; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 16px; color: #1e3a8a; }
    .hwa-info mat-icon { background: #2563eb; color: #fff; border-radius: 10px; padding: 8px; box-sizing: content-box; width: 22px; height: 22px; font-size: 22px; }
    .hwa-info strong { display: block; font-size: 15px; }
    .hwa-info span { font-size: 12.5px; color: #3b82f6; }
    .hwa-filters { display: flex; flex-wrap: wrap; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 14px 0; }
    .hwa-field { flex: 1 1 170px; min-width: 150px; }
    .field-locked { opacity: 0.95; }
    .field-locked ::ng-deep .mat-mdc-text-field-wrapper {
      background-color: #f1f5f9 !important;
      cursor: not-allowed !important;
    }
    .field-locked ::ng-deep .mat-mdc-select-value {
      font-weight: 700 !important;
      color: #1e3a8a !important;
    }
    .ct-highlight-opt {
      font-weight: 700 !important;
      color: #1d4ed8 !important;
      background: #eff6ff !important;
    }
    .ct-pill-badge {
      font-size: 10px;
      font-weight: 700;
      color: #1e40af;
      background: #dbeafe;
      border: 1px solid #bfdbfe;
      border-radius: 999px;
      padding: 1px 7px;
      margin-left: 6px;
    }
    .hwa-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .hwa-presets .spacer { flex: 1; }
    .hwa-kpis { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
    .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; }
    .kpi .k-val { font-size: 22px; font-weight: 800; color: #0f172a; }
    .kpi .k-lbl { font-size: 12px; color: #64748b; font-weight: 600; }
    .kpi.ok .k-val { color: #16a34a; } .kpi.mid .k-val { color: #d97706; } .kpi.bad .k-val { color: #dc2626; }
    .kpi.pend .k-val { color: #64748b; } .kpi.blue .k-val { color: #2563eb; }
    .hwa-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; }
    .hwa-card-title { display: flex; align-items: center; gap: 8px; font-weight: 800; color: #1e3a8a; margin-bottom: 10px; }
    .hwa-chip.warn { margin-left: auto; background: #fee2e2; color: #b91c1c; font-size: 12px; border-radius: 999px; padding: 3px 12px; font-weight: 700; }
    .table-responsive { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .hwa-table { width: 100%; border-collapse: collapse; }
    .hwa-table th { text-align: left; font-size: 12px; color: #475569; background: #f1f5f9; padding: 8px 10px; white-space: nowrap; }
    .hwa-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; white-space: nowrap; }
    .hwa-table td.strong { font-weight: 700; color: #0f172a; }
    .hwa-table tr.alert-row td { background: #fef2f2; }
    .empty-cell { text-align: center; color: #94a3b8; padding: 24px !important; }
    .bar { display: inline-block; vertical-align: middle; width: 110px; height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin-right: 8px; }
    .fill { height: 100%; border-radius: 999px; }
    .fill.good { background: #16a34a; } .fill.avg { background: #f59e0b; } .fill.low { background: #dc2626; }
    .pct { font-weight: 700; font-size: 12.5px; }
    @media (max-width: 1280px) { .hwa-kpis { grid-template-columns: repeat(4, 1fr); } }
    @media (max-width: 1024px) {
      .hwa-kpis { grid-template-columns: repeat(2, 1fr); }
      .hwa-filters { padding: 12px; gap: 10px; }
      .hwa-field { flex: 1 1 calc(50% - 10px); min-width: 140px; }
      .hwa-presets { gap: 6px; }
    }
    @media (max-width: 640px) {
      .hwa-kpis { grid-template-columns: 1fr; }
      .hwa-filters { flex-direction: column; align-items: stretch; padding: 12px; gap: 8px; }
      .hwa-field { width: 100%; min-width: 0; }
      .hwa-presets { flex-direction: column; align-items: stretch; gap: 6px; }
      .hwa-presets button { width: 100%; justify-content: center; }
      .hwa-presets .spacer { display: none; }
      .hwa-card { padding: 10px; }
      .hwa-table th, .hwa-table td { padding: 6px 8px; font-size: 12px; }
    }
  `]
})
export class HwAnalyticsPanelComponent implements OnInit, OnChanges, OnDestroy {
  @Input() classes: any[] = [];
  @Input() classId = '';
  @Input() sectionId = '';
  @Input() isClassTeacherLocked = false;
  @Input() teacherAssignedSectionId = '';

  form: FormGroup;
  sections: any[] = [];
  data: HwAnalytics | null = null;
  loading = false;
  private subs = new Subscription();

  constructor(private fb: FormBuilder, private http: HttpClient, private confirmDialog: ConfirmDialogService) {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 29);
    this.form = this.fb.group({
      classId: [''],
      sectionId: [''],
      from: [localDateString(from)],
      to: [localDateString(today)],
      sort: ['roll']
    });
  }

  ngOnInit(): void {
    this.subs.add(this.form.get('classId')!.valueChanges.subscribe(v => {
      this.sections = sectionsOf(this.classes, v);
      this.form.get('sectionId')!.setValue('', { emitEvent: false });
      this.load();
    }));
    this.subs.add(this.form.get('sectionId')!.valueChanges.subscribe(() => this.load()));
    this.subs.add(this.form.get('from')!.valueChanges.subscribe(() => this.load()));
    this.subs.add(this.form.get('to')!.valueChanges.subscribe(() => this.load()));
    this.syncFromInputs();
    this.applyClassTeacherLock();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['classId'] || changes['sectionId'] || changes['classes'] || changes['isClassTeacherLocked'] || changes['teacherAssignedSectionId']) && this.form) {
      this.syncFromInputs();
      this.applyClassTeacherLock();
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private applyClassTeacherLock(): void {
    if (!this.form) return;
    if (this.isClassTeacherLocked) {
      this.form.get('classId')?.disable({ emitEvent: false });
      if (this.teacherAssignedSectionId) {
        this.form.get('sectionId')?.disable({ emitEvent: false });
      } else {
        this.form.get('sectionId')?.enable({ emitEvent: false });
      }
    } else {
      this.form.get('classId')?.enable({ emitEvent: false });
      this.form.get('sectionId')?.enable({ emitEvent: false });
    }
  }

  private syncFromInputs(): void {
    const raw = this.form.getRawValue();
    const cid = this.classId || raw.classId || (this.classes[0]?.id ?? '');
    if (!cid) return;
    const changedClass = cid !== raw.classId;
    const sid = changedClass || this.sectionId !== raw.sectionId ? (this.sectionId || '') : raw.sectionId;
    this.sections = sectionsOf(this.classes, cid);
    if (changedClass || sid !== raw.sectionId) {
      this.form.patchValue({ classId: cid, sectionId: sid }, { emitEvent: false });
      this.load();
    }
    this.applyClassTeacherLock();
  }

  preset(days: number): void {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - (days - 1));
    this.form.patchValue({ from: localDateString(from), to: localDateString(today) }, { emitEvent: false });
    this.load();
  }

  presetMonth(): void {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    this.form.patchValue({ from: localDateString(from), to: localDateString(today) }, { emitEvent: false });
    this.load();
  }

  load(): void {
    const v = this.form.getRawValue();
    if (!v.classId || !v.from || !v.to) return;
    this.loading = true;
    let url = `${API_BASE}/homework/daily-diary/hw-analytics?classId=${v.classId}&from=${v.from}&to=${v.to}`;
    if (v.sectionId) url += `&sectionId=${v.sectionId}`;
    this.http.get<HwAnalytics>(url).subscribe({
      next: r => { this.data = r; this.loading = false; },
      error: err => {
        this.loading = false;
        this.data = null;
        this.confirmDialog.alert('Could Not Load Analytics', err?.error?.message || 'Please try again.', 'danger');
      }
    });
  }

  band(pct: number): string {
    return pct >= 75 ? 'good' : pct >= 50 ? 'avg' : 'low';
  }

  isDefaulter(s: HwAnalyticsStudent): boolean {
    return s.assigned - s.pending > 0 && s.completionPercent < 50;
  }

  get defaulterCount(): number {
    return (this.data?.students || []).filter(s => this.isDefaulter(s)).length;
  }

  get sortedStudents(): HwAnalyticsStudent[] {
    const list = [...(this.data?.students || [])];
    const sortVal = this.form.getRawValue().sort;
    switch (sortVal) {
      case 'lowest': return list.sort((a, b) => a.completionPercent - b.completionPercent);
      case 'highest': return list.sort((a, b) => b.completionPercent - a.completionPercent);
      case 'roll':
      default:
        return list.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
    }
  }

  exportCsv(): void {
    if (!this.data) return;
    const raw = this.form.getRawValue();
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Roll', 'Student', 'Assigned', 'Completed', 'Partial', 'NotDone', 'Unchecked', 'Absent', 'Completion %'];
    const lines = [header.map(esc).join(',')];
    for (const s of this.sortedStudents) {
      lines.push([s.rollNumber, s.studentName, s.assigned, s.completed, s.partial, s.notDone, s.pending, s.absentExcused, s.completionPercent].map(esc).join(','));
    }
    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hw-analytics_${raw.from}_to_${raw.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
