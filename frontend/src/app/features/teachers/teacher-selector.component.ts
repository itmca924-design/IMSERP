import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, ViewChild, ElementRef, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { API_BASE, TeacherDto } from './teacher.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-teacher-selector',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatButtonModule
],
  template: `
    <mat-card class="selector-card mat-elevation-z1">
      <div class="selector-container">
        <!-- Left: Icon Box + Dropdown Field -->
        <div class="selector-control-group">
          <div class="selector-icon-box">
            <mat-icon>person_search</mat-icon>
          </div>
    
          <mat-form-field appearance="outline" class="selector-field" subscriptSizing="dynamic">
            <mat-label>Select Staff / Faculty Member</mat-label>
            <mat-select [(ngModel)]="selectedId"
              (ngModelChange)="onSelect($event)"
              [disabled]="isSelfOnlyMode && teachers.length <= 1"
              panelClass="teacher-select-panel"
              (openedChange)="onSelectOpened($event)">
    
              <!-- Custom Trigger when Select is closed (Only Teacher Name) -->
              <mat-select-trigger>
                @if (selected) {
                  <span class="trigger-name">{{ selected.fullName }}</span>
                }
              </mat-select-trigger>
    
              <!-- Sticky Search Box Option inside Dropdown -->
              <mat-option disabled class="select-search-option">
                <div class="select-search-wrap" (click)="$event.stopPropagation()" (mousedown)="$event.stopPropagation()">
                  <div class="search-input-box">
                    <mat-icon class="search-icon">search</mat-icon>
                    <input #searchInput
                      type="text"
                      class="search-inner-input"
                      placeholder="Search by name, code, subject, department..."
                      [value]="searchQuery"
                      (input)="onSearchInput($event)"
                      (click)="$event.stopPropagation()"
                      (mousedown)="$event.stopPropagation()"
                      (keydown)="$event.stopPropagation()"
                      (keyup)="$event.stopPropagation()" />
                    @if (searchQuery) {
                      <button type="button"
                        class="clear-search-btn"
                        (click)="clearSearch($event)"
                        (mousedown)="$event.stopPropagation()"
                        matTooltip="Clear search">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>
    
                  <div class="search-stats-bar">
                    <span class="stats-count">
                      <strong>{{ filteredTeachers.length }}</strong> of {{ teachers.length }} faculty
                    </span>
                    @if (!searchQuery) {
                      <span class="stats-hint">Multi-search: Name, Code, Subject</span>
                    }
                    @if (searchQuery) {
                      <span class="stats-active">Filtering: "{{ searchQuery }}"</span>
                    }
                  </div>
                </div>
              </mat-option>
    
              <!-- Empty State when search has no matches -->
              @if (filteredTeachers.length === 0) {
                <mat-option disabled class="no-teachers-option">
                  <div class="no-teachers-box">
                    <mat-icon>search_off</mat-icon>
                    <p>No faculty or staff found matching "<strong>{{ searchQuery }}</strong>"</p>
                    <button type="button" class="reset-filter-btn" (click)="clearSearch($event)" (mousedown)="$event.stopPropagation()">
                      <mat-icon>refresh</mat-icon> Show All Teachers
                    </button>
                  </div>
                </mat-option>
              }
    
              <!-- Options List with Full Subject & Department Details -->
              @for (t of filteredTeachers; track t) {
                <mat-option [value]="t.id" class="teacher-custom-option">
                  <div class="teacher-option-card">
                    <!-- Row 1: Code + Full Name + Role Tag + Status Dot -->
                    <div class="opt-row-primary">
                      <span class="opt-code-badge">{{ t.employeeCode }}</span>
                      <span class="opt-name">{{ t.fullName }}</span>
                      <span class="staff-tag" [class.non-teach]="isNonTeaching(t)">
                        {{ isNonTeaching(t) ? (t.designation || 'Staff') : 'Faculty' }}
                      </span>
                      <span class="opt-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"
                      [matTooltip]="t.isActive ? 'Active Staff' : 'Inactive Staff'"></span>
                    </div>
                    <!-- Row 2: Subject Badge + Department + Experience -->
                    <div class="opt-row-secondary">
                      <!-- Subject Pill with Theme Color & Icon -->
                      @if (getTeacherSubject(t)) {
                        <span class="opt-subject-pill"
                          [style.background]="getSubjectTheme(getTeacherSubject(t)).bg"
                          [style.border-color]="getSubjectTheme(getTeacherSubject(t)).border"
                          [style.color]="getSubjectTheme(getTeacherSubject(t)).darkText">
                          <mat-icon class="sub-icon">{{ getSubjectTheme(getTeacherSubject(t)).icon }}</mat-icon>
                          <strong class="sub-name">{{ getTeacherSubject(t) }}</strong>
                        </span>
                      }
                      <!-- Department tag -->
                      @if (t.department && t.department !== getTeacherSubject(t)) {
                        <span class="opt-dept-chip">
                          <mat-icon class="dept-icon">apartment</mat-icon>
                          <span>{{ t.department }}</span>
                        </span>
                      }
                      <!-- Experience tag -->
                      @if (!isNonTeaching(t) && t.experienceYears) {
                        <span class="opt-exp-chip">
                          {{ t.experienceYears }} yrs exp
                        </span>
                      }
                    </div>
                  </div>
                </mat-option>
              }
    
            </mat-select>
    
            <!-- Self-only badge shown when teacher logs in -->
            @if (isSelfOnlyMode) {
              <mat-hint class="self-hint">
                <mat-icon style="font-size:12px;width:12px;height:12px;vertical-align:middle;color:#16a34a;">lock</mat-icon>
                Viewing your own records
              </mat-hint>
            }
          </mat-form-field>
        </div>
    
        <!-- Right: Clean Quick Status & Metadata Badges -->
        @if (selected) {
          <div class="selector-quick-meta">
            <div class="selector-v-divider"></div>
            <!-- Subject Pill -->
            @if (getTeacherSubject(selected)) {
              <span class="meta-pill subj"
                [style.background]="getSubjectTheme(getTeacherSubject(selected)).bg"
                [style.border-color]="getSubjectTheme(getTeacherSubject(selected)).border"
                [style.color]="getSubjectTheme(getTeacherSubject(selected)).darkText">
                <mat-icon class="pill-icon">{{ getSubjectTheme(getTeacherSubject(selected)).icon }}</mat-icon>
                <span class="pill-text">{{ getTeacherSubject(selected) }}</span>
              </span>
            }
            <!-- Department Pill (if no subject) -->
            @if (!getTeacherSubject(selected) && selected.department) {
              <span class="meta-pill dept">
                <mat-icon class="pill-icon">apartment</mat-icon>
                <span class="pill-text">{{ selected.department }}</span>
              </span>
            }
            <!-- Contact Phone Pill -->
            @if (selected.phoneNumber) {
              <span class="meta-pill phone">
                <mat-icon class="pill-icon">call</mat-icon>
                <span>{{ selected.phoneNumber }}</span>
              </span>
            }
            <!-- Experience Pill -->
            @if (selected.experienceYears !== undefined && selected.experienceYears !== null) {
              <span class="meta-pill exp">
                <mat-icon class="pill-icon">history_edu</mat-icon>
                <span>{{ selected.experienceYears }} Yrs Exp</span>
              </span>
            }
            <!-- Active Status Pill -->
            <span class="meta-pill status" [class.active]="selected.isActive" [class.inactive]="!selected.isActive">
              <span class="status-dot"></span>
              <span>{{ selected.isActive ? 'Active Staff' : 'Inactive' }}</span>
            </span>
          </div>
        }
    
        <!-- Placeholder hint when no staff is selected -->
        @if (!selected) {
          <div class="selector-empty-hint">
            <mat-icon>touch_app</mat-icon>
            <span>Select any staff member from the dropdown to load records</span>
          </div>
        }
      </div>
    </mat-card>
    `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
    .selector-card { 
      padding: 10px 18px; 
      border-radius: 12px; 
      background: #ffffff; 
      border: 1px solid #e2e8f0; 
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
      box-sizing: border-box;
      width: 100%;
      max-width: 100%;
    }

    .selector-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: nowrap;
      width: 100%;
      max-width: 100%;
      min-width: 0;
    }

    .selector-control-group {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 0 0 380px;
      max-width: 420px;
      min-width: 0;
    }

    .selector-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #eff6ff;
      color: #2563eb;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(37, 99, 235, 0.12);
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }

    .selector-field {
      flex: 1 1 auto;
      width: 100%;
      min-width: 0 !important;
      margin-bottom: 0 !important;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }

      ::ng-deep .mat-mdc-text-field-wrapper {
        width: 100% !important;
        box-sizing: border-box !important;
        height: 42px !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }
      ::ng-deep .mat-mdc-form-field-flex {
        width: 100% !important;
        height: 42px !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }
      ::ng-deep .mat-mdc-form-field-infix {
        min-width: 0 !important;
        width: 100% !important;
        min-height: unset !important;
        padding-top: 0 !important;
        padding-bottom: 0 !important;
        display: flex !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }
      ::ng-deep .mat-mdc-floating-label {
        top: 50% !important;
        transform: translateY(-50%) !important;
      }
      ::ng-deep .mat-mdc-floating-label.mdc-floating-label--float-above {
        top: 0 !important;
        transform: translateY(-50%) scale(0.75) !important;
      }

      ::ng-deep .mat-mdc-select-trigger {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        height: 100% !important;
        min-height: unset !important;
        box-sizing: border-box;
        width: 100% !important;
      }
      ::ng-deep .mat-mdc-select-value {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
      }
      ::ng-deep .mat-mdc-select-arrow-wrapper {
        flex-shrink: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 20px !important;
        height: 20px !important;
        margin-left: 6px !important;
        transform: none !important;
      }
      ::ng-deep .mat-mdc-select-arrow {
        color: #475569 !important;
        svg {
          fill: #475569 !important;
        }
      }
    }

    /* Selected Trigger view */
    .trigger-name {
      font-weight: 700;
      color: #0f172a;
      font-size: 0.94rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: block;
      width: 100%;
    }

    .selector-v-divider {
      width: 1px;
      height: 28px;
      background: #e2e8f0;
      margin: 0 4px;
      flex-shrink: 0;
    }

    /* Right Quick Meta Strip */
    .selector-quick-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: nowrap;
      justify-content: flex-end;
      flex: 1 1 auto;
      min-width: 0;
    }

    .meta-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.74rem;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 7px;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      color: #334155;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s ease;

      .pill-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &.subj {
        border: 1px solid;
        white-space: nowrap;
        flex-shrink: 0;
        .pill-text {
          white-space: nowrap;
        }
      }

      &.dept {
        background: #f1f5f9;
        color: #475569;
        border-color: #cbd5e1;
        .pill-icon { color: #64748b; }
      }

      &.phone {
        background: #f0fdf4;
        color: #166534;
        border-color: #bbf7d0;
        .pill-icon { color: #16a34a; }
      }

      &.exp {
        background: #eff6ff;
        color: #1e40af;
        border-color: #bfdbfe;
        .pill-icon { color: #2563eb; }
      }

      &.status {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #475569;

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        &.active {
          background: #f0fdf4;
          border-color: #bbf7d0;
          color: #15803d;
          .status-dot { background: #22c55e; }
        }

        &.inactive {
          background: #fef2f2;
          border-color: #fecaca;
          color: #b91c1c;
          .status-dot { background: #ef4444; }
        }
      }
    }

    .selector-empty-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      font-size: 0.82rem;
      margin-left: auto;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
    }

    .self-hint { color: #16a34a; font-size: 0.72rem; font-weight: 600; display: flex; align-items: center; gap: 3px; }

    /* Mobile Responsive Rules */
    @media (max-width: 768px) {
      .selector-card {
        padding: 10px 12px;
      }
      .selector-container {
        gap: 10px;
        flex-wrap: wrap !important;
      }
      .selector-v-divider {
        display: none;
      }
      .selector-control-group {
        width: 100% !important;
        max-width: 100% !important;
        flex: 1 1 100% !important;
        gap: 8px;
      }
      .selector-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
      }
      .selector-field {
        width: 100% !important;
        flex: 1 1 auto !important;
        min-width: 0 !important;
      }
      .selector-quick-meta {
        width: 100% !important;
        flex: 1 1 100% !important;
        justify-content: flex-start !important;
        border-top: 1px solid #f1f5f9;
        padding-top: 8px;
        margin-top: 2px;
        gap: 6px;
        flex-wrap: wrap !important;
      }
      .meta-pill {
        font-size: 0.72rem;
        padding: 3px 8px;
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
       DROPDOWN PANEL & CUSTOM SEARCH STYLING (Material Overlay)
       ═══════════════════════════════════════════════════════════════════════ */
    ::ng-deep .teacher-select-panel {
      min-width: 400px !important;
      max-width: 540px !important;
      border-radius: 12px !important;
      box-shadow: 0 12px 30px -4px rgba(15, 23, 42, 0.18), 0 4px 10px -2px rgba(15, 23, 42, 0.08) !important;
      max-height: 440px !important;
    }

    ::ng-deep .select-search-option {
      height: auto !important;
      min-height: unset !important;
      padding: 0 !important;
      position: sticky !important;
      top: 0 !important;
      z-index: 20 !important;
      background: #ffffff !important;
      border-bottom: 1px solid #e2e8f0 !important;
      cursor: default !important;

      &.mat-mdc-option[aria-disabled="true"],
      &.mdc-list-item--disabled {
        opacity: 1 !important;
        pointer-events: auto !important;
        cursor: default !important;
      }

      .mdc-list-item__primary-text {
        width: 100% !important;
        pointer-events: auto !important;
        padding: 0 !important;
      }

      &:hover, &:focus {
        background: #ffffff !important;
      }
    }

    .select-search-wrap {
      padding: 10px 14px 8px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
      width: 100%;
      box-sizing: border-box;
    }

    .search-input-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 10px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;

      &:focus-within {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
      }
    }

    .search-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
      flex-shrink: 0;
    }

    .search-inner-input {
      flex: 1 1 auto;
      border: none;
      outline: none;
      font-size: 0.85rem;
      color: #0f172a;
      background: transparent;
      padding: 4px 0;
      width: 100%;
      box-sizing: border-box;
      pointer-events: auto !important;
      cursor: text !important;

      &::placeholder {
        color: #94a3b8;
        font-size: 0.82rem;
      }
    }

    .clear-search-btn {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      transition: color 0.15s;

      &:hover {
        color: #0f172a;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .search-stats-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 6px;
      padding: 0 2px;
    }

    .stats-count strong {
      color: #2563eb;
    }

    .stats-active {
      color: #d97706;
      font-weight: 600;
    }

    /* Option Items in Dropdown */
    ::ng-deep .teacher-custom-option {
      height: auto !important;
      min-height: 52px !important;
      padding: 8px 14px !important;
      border-bottom: 1px solid #f1f5f9 !important;
      transition: background 0.15s ease !important;

      &:hover {
        background: #f8faff !important;
      }

      &.mdc-list-item--selected:not(.mdc-list-item--disabled) {
        background: #eff6ff !important;
      }
    }

    .teacher-option-card {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 100%;
      line-height: 1.25;
    }

    .opt-row-primary {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .opt-code-badge {
      font-size: 0.72rem;
      font-weight: 800;
      color: #1e40af;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1px 5px;
      border-radius: 4px;
      letter-spacing: 0.02em;
    }

    .opt-name {
      font-size: 0.88rem;
      font-weight: 700;
      color: #0f172a;
    }

    .opt-row-secondary {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 2px;
    }

    .opt-subject-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      border: 1px solid;
    }

    .sub-icon {
      font-size: 12px !important;
      width: 12px !important;
      height: 12px !important;
    }

    .sub-name {
      letter-spacing: -0.01em;
    }

    .opt-dept-chip {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.7rem;
      color: #475569;
      background: #f1f5f9;
      padding: 1px 6px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    .dept-icon {
      font-size: 11px !important;
      width: 11px !important;
      height: 11px !important;
      color: #64748b;
    }

    .opt-exp-chip {
      font-size: 0.68rem;
      color: #64748b;
      font-weight: 600;
      background: #f8fafc;
      padding: 1px 5px;
      border-radius: 3px;
    }

    /* Empty state */
    ::ng-deep .no-teachers-option {
      padding: 20px !important;
      height: auto !important;
      cursor: default !important;
    }

    .no-teachers-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 6px;
      width: 100%;
      color: #64748b;

      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
        color: #94a3b8;
      }

      p {
        margin: 0;
        font-size: 0.82rem;
      }
    }

    .reset-filter-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #2563eb;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      cursor: pointer;
      margin-top: 4px;

      mat-icon {
        font-size: 13px !important;
        width: 13px !important;
        height: 13px !important;
        color: #2563eb !important;
      }

      &:hover {
        background: #dbeafe;
      }
    }

    @media (max-width: 680px) {
      .selector-card { padding: 10px 12px; }
      .selector-row { gap: 10px; }
      .selector-left { width: 100%; gap: 10px; }
      .selector-field { width: 100%; max-width: 100%; min-width: 100%; }
      .teacher-quick { width: 100%; font-size: 0.78rem; gap: 6px; }
      .teacher-info-badge { width: 100%; margin-left: 0; justify-content: flex-start; margin-top: 4px; box-sizing: border-box; }
    }
  `]
})
export class TeacherSelectorComponent implements OnInit, OnChanges {
  @Input() preSelectId: string | null = null;
  @Input() activeOnly: boolean = true;
  @Input() staffTypeFilter: 'All' | 'Teaching' | 'NonTeaching' = 'All';
  @Output() teacherSelected = new EventEmitter<TeacherDto>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  teachers: TeacherDto[] = [];
  filteredTeachers: TeacherDto[] = [];
  selectedId: string = '';
  selected: TeacherDto | null = null;
  searchQuery: string = '';

  /** True when a Teacher-role user is logged in (self-service mode) */
  isSelfOnlyMode = false;
  private loggedInUserId: string | null = null;

  constructor(private http: HttpClient, private auth: AuthService) { }

  isNonTeaching(t: TeacherDto | null): boolean {
    if (!t) return false;
    return t.staffType === 'NonTeaching' || t.staffType === 2;
  }

  ngOnInit() {
    const user = this.auth.currentUser();
    this.isSelfOnlyMode = this.auth.isTeacher();
    this.loggedInUserId = user?.userId ?? null;
    this.loadTeachers();
  }

  loadTeachers() {
    const url = `${API_BASE}/teachers/paged?pageSize=500&sortBy=fullName&isActive=true`;

    this.http.get<any>(url).subscribe({
      next: r => {
        let raw: TeacherDto[] = (r.items || []).filter((t: TeacherDto) => t.isActive);

        // ── Role-based filtering ──────────────────────────────────────────
        if (this.isSelfOnlyMode) {
          const user = this.auth.currentUser();
          const selfFiltered = raw.filter(t => {
            const matchUserId = !!(this.loggedInUserId && t.userId && t.userId.toLowerCase() === this.loggedInUserId.toLowerCase());
            const matchUsername = !!(user?.username && t.username && t.username.toLowerCase() === user.username.toLowerCase());
            const matchName = !!(user?.fullName && t.fullName && t.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase());
            return matchUserId || matchUsername || matchName;
          });

          if (selfFiltered.length > 0) {
            raw = selfFiltered;
          }
        }

        if (this.staffTypeFilter === 'Teaching') {
          raw = raw.filter(t => !this.isNonTeaching(t));
        } else if (this.staffTypeFilter === 'NonTeaching') {
          raw = raw.filter(t => this.isNonTeaching(t));
        }

        this.teachers = raw;
        this.filterTeachers();

        // Auto-select: preSelectId takes priority, then self-only auto-pick
        if (this.preSelectId) {
          this.applyPreSelect();
        } else if (this.isSelfOnlyMode && raw.length === 1) {
          this.selectedId = raw[0].id;
          this.selected = raw[0];
          this.teacherSelected.emit(raw[0]);
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['preSelectId'] || changes['staffTypeFilter']) && this.teachers.length > 0) {
      if (changes['staffTypeFilter']) {
        this.loadTeachers();
      } else {
        this.applyPreSelect();
      }
    }
  }

  private applyPreSelect() {
    if (!this.preSelectId) return;
    this.selectedId = this.preSelectId;
    this.selected = this.teachers.find(t => t.id === this.preSelectId) || null;
    if (this.selected) {
      this.teacherSelected.emit(this.selected);
    } else if (this.isSelfOnlyMode && this.teachers.length > 0) {
      this.selectedId = this.teachers[0].id;
      this.selected = this.teachers[0];
      this.teacherSelected.emit(this.selected);
    }
  }

  onSelect(id: string) {
    this.selected = this.teachers.find(t => t.id === id) || null;
    if (this.selected) this.teacherSelected.emit(this.selected);
  }

  onSelectOpened(isOpen: boolean): void {
    if (isOpen) {
      setTimeout(() => {
        this.searchInputElement?.nativeElement?.focus();
      }, 120);
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery = target?.value || '';
    this.filterTeachers();
  }

  clearSearch(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.searchQuery = '';
    this.filterTeachers();
    this.searchInputElement?.nativeElement?.focus();
  }

  /**
   * Multi-criteria Search Filter
   * Matches across: Name, Employee Code, Subject / Specialization, Department, Designation, Qualification, Phone
   * Supports multi-word queries: "math priyanka" or "ai amit 006"
   */
  filterTeachers(): void {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      this.filteredTeachers = [...this.teachers];
      return;
    }

    const tokens = this.searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    this.filteredTeachers = this.teachers.filter(t => {
      const name = (t.fullName || '').toLowerCase();
      const code = (t.employeeCode || '').toLowerCase();
      const subject = (t.specialization || '').toLowerCase();
      const dept = (t.department || '').toLowerCase();
      const desig = (t.designation || '').toLowerCase();
      const qual = (t.qualification || '').toLowerCase();
      const phone = (t.phoneNumber || '').toLowerCase();

      // Every typed word must match at least one attribute of the teacher
      return tokens.every(token =>
        name.includes(token) ||
        code.includes(token) ||
        subject.includes(token) ||
        dept.includes(token) ||
        desig.includes(token) ||
        qual.includes(token) ||
        phone.includes(token)
      );
    });
  }

  getTeacherSubject(t: TeacherDto | null | undefined): string {
    if (!t) return '';
    if (t.specialization && t.specialization.trim()) {
      return t.specialization.trim();
    }
    if (this.isNonTeaching(t)) {
      return t.designation || t.department || 'Staff';
    }
    return t.department || 'General Faculty';
  }

  /**
   * Subject Theme Colors & Icons for Faculty Badges
   */
  getSubjectTheme(subject: string | null | undefined): { bg: string; border: string; darkText: string; icon: string } {
    if (!subject) {
      return { bg: '#f1f5f9', border: '#94a3b8', darkText: '#334155', icon: 'school' };
    }
    const clean = subject.trim().toLowerCase();

    if (clean.includes('comp') || clean.includes('it') || clean.includes('ai') || clean.includes('robot') || clean.includes('code')) {
      return { bg: '#eef2ff', border: '#4f46e5', darkText: '#1e1b4b', icon: 'terminal' };
    }
    if (clean.includes('math') || clean.includes('stat') || clean.includes('calculus')) {
      return { bg: '#eff6ff', border: '#2563eb', darkText: '#172554', icon: 'calculate' };
    }
    if (clean.includes('physic')) {
      return { bg: '#f5f3ff', border: '#7c3aed', darkText: '#2e1065', icon: 'bolt' };
    }
    if (clean.includes('chem')) {
      return { bg: '#f0fdfa', border: '#0d9488', darkText: '#042f2e', icon: 'science' };
    }
    if (clean.includes('bio') || clean.includes('zool') || clean.includes('botan') || clean.includes('medic')) {
      return { bg: '#ecfdf5', border: '#059669', darkText: '#022c22', icon: 'biotech' };
    }
    if (clean.includes('eng') || clean.includes('debate') || clean.includes('communicat') || clean.includes('lit')) {
      return { bg: '#fffbeb', border: '#d97706', darkText: '#451a03', icon: 'menu_book' };
    }
    if (clean.includes('hindi') || clean.includes('sanskrit') || clean.includes('urdu') || clean.includes('lang')) {
      return { bg: '#fef2f2', border: '#ef4444', darkText: '#450a0a', icon: 'translate' };
    }
    if (clean.includes('econ') || clean.includes('account') || clean.includes('tax') || clean.includes('bus') || clean.includes('comm')) {
      return { bg: '#f0fdf4', border: '#16a34a', darkText: '#052e16', icon: 'query_stats' };
    }
    if (clean.includes('geog') || clean.includes('hist') || clean.includes('social') || clean.includes('civic') || clean.includes('human')) {
      return { bg: '#f0f9ff', border: '#0284c7', darkText: '#082f49', icon: 'public' };
    }
    if (clean.includes('sport') || clean.includes('phys') || clean.includes('fit') || clean.includes('yoga')) {
      return { bg: '#ecfeff', border: '#0891b2', darkText: '#083344', icon: 'sports_soccer' };
    }
    if (clean.includes('art') || clean.includes('music') || clean.includes('vocal') || clean.includes('paint') || clean.includes('craft')) {
      return { bg: '#fdf2f8', border: '#db2777', darkText: '#500724', icon: 'palette' };
    }
    if (clean.includes('counsel') || clean.includes('psych') || clean.includes('well')) {
      return { bg: '#faf5ff', border: '#9333ea', darkText: '#3b0764', icon: 'psychology' };
    }

    return { bg: '#f0f9ff', border: '#2563eb', darkText: '#1e3a8a', icon: 'school' };
  }
}
