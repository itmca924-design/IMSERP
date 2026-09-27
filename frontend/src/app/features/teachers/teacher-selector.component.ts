import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { API_BASE, TeacherDto } from './teacher.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-teacher-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatCardModule, MatTooltipModule],
  template: `
    <mat-card class="selector-card mat-elevation-z1">
      <div class="selector-row">
        <div class="selector-left">
          <mat-icon color="primary" class="selector-icon">person_search</mat-icon>
          <mat-form-field appearance="outline" class="selector-field">
            <mat-label>Select Staff / Faculty Member</mat-label>
            <mat-select [(ngModel)]="selectedId" (ngModelChange)="onSelect($event)"
                        [disabled]="isSelfOnlyMode && teachers.length <= 1">
              <mat-option *ngFor="let t of teachers" [value]="t.id">
                <span class="opt-code">{{t.employeeCode}}</span>
                &nbsp;–&nbsp;{{t.fullName}}
                <span class="staff-tag" [class.non-teach]="isNonTeaching(t)">
                  {{ isNonTeaching(t) ? (t.designation || 'Staff') : 'Faculty' }}
                </span>
                <span class="opt-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"></span>
              </mat-option>
            </mat-select>
            <!-- Self-only badge shown when teacher logs in -->
            <mat-hint *ngIf="isSelfOnlyMode" class="self-hint">
              <mat-icon style="font-size:12px;width:12px;height:12px;vertical-align:middle;color:#16a34a;">lock</mat-icon>
              Viewing your own records
            </mat-hint>
          </mat-form-field>
          <div class="teacher-quick" *ngIf="selected">
            <mat-icon>{{ isNonTeaching(selected) ? 'badge' : 'school' }}</mat-icon>
            <span>{{ isNonTeaching(selected) ? ((selected.designation || 'Staff') + (selected.department ? ' • ' + selected.department : '')) : (selected.specialization || 'Faculty') }}</span>
            <mat-icon style="margin-left:12px">phone</mat-icon>
            <span>{{selected.phoneNumber}}</span>
            <span class="exp-badge" *ngIf="isNonTeaching(selected)" style="background:#e0e7ff; color:#3730a3;">{{selected.department || 'Non-Teaching'}}</span>
            <span class="exp-badge" *ngIf="!isNonTeaching(selected)">{{selected.experienceYears}} yrs exp</span>
          </div>
        </div>

        <!-- Shifted from bottom toolbar to here -->
        <div class="teacher-info-badge" *ngIf="selected">
          <mat-icon class="badge-icon">account_circle</mat-icon>
          <div class="teacher-meta-text">
            <strong>{{selected.fullName}}</strong>
            <span class="emp-code">{{selected.employeeCode}}</span>
          </div>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    .selector-card { padding: 12px 20px; border-radius: 12px; background: #f0f7ff; border: 1px solid #bbdefb; }
    .selector-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .selector-left { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; flex: 1; }
    .selector-icon { font-size: 28px; width: 28px; height: 28px; }
    .selector-field { flex: 1; min-width: 260px; max-width: 380px; }
    .teacher-quick { display: flex; align-items: center; gap: 6px; font-size: .85rem; color: #334155; flex-wrap: wrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1976d2; } }
    .exp-badge { background: #e3f2fd; color: #1565c0; font-size: .72rem; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 8px; }
    .opt-code { font-weight: 700; color: #1976d2; }
    .staff-tag { font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: #e0f2fe; color: #0369a1; font-weight: 600; margin-left: 6px; }
    .staff-tag.non-teach { background: #ede9fe; color: #6d28d9; }
    .opt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; vertical-align: middle;
      &.active { background: #4caf50; } &.inactive { background: #f44336; } }
    .self-hint { color: #16a34a; font-size: 0.72rem; font-weight: 600; display: flex; align-items: center; gap: 3px; }

    /* Teacher Info Badge shifted to right */
    .teacher-info-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      background: #ffffff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(37, 99, 235, 0.08);
      margin-left: auto;
    }
    .badge-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: #2563eb;
    }
    .teacher-meta-text {
      strong { font-size: .95rem; color: #0f172a; display: block; font-weight: 700; }
      .emp-code { font-size: .76rem; color: #2563eb; font-weight: 700; letter-spacing: 0.2px; }
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

  teachers: TeacherDto[] = [];
  selectedId: string = '';
  selected: TeacherDto | null = null;

  /** True when a Teacher-role user is logged in (self-service mode) */
  isSelfOnlyMode = false;
  private loggedInUserId: string | null = null;

  constructor(private http: HttpClient, private auth: AuthService) {}

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
    const url = this.activeOnly
      ? `${API_BASE}/teachers/paged?pageSize=500&sortBy=fullName&isActive=true`
      : `${API_BASE}/teachers/paged?pageSize=500&sortBy=fullName`;

    this.http.get<any>(url).subscribe({
      next: r => {
        let raw: TeacherDto[] = r.items || [];
        if (this.activeOnly) raw = raw.filter(t => t.isActive);

        // ── Role-based filtering ──────────────────────────────────────────
        // When a Teacher (faculty) is logged in, show only their own record.
        // Admin / HR / SuperAdmin see the full list.
        if (this.isSelfOnlyMode) {
          const user = this.auth.currentUser();
          const selfFiltered = raw.filter(t => {
            const matchUserId = !!(this.loggedInUserId && t.userId && t.userId.toLowerCase() === this.loggedInUserId.toLowerCase());
            const matchUsername = !!(user?.username && t.username && t.username.toLowerCase() === user.username.toLowerCase());
            const matchName = !!(user?.fullName && t.fullName && t.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase());
            return matchUserId || matchUsername || matchName;
          });

          // Only restrict if we found the self record (fail-safe)
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

        // Auto-select: preSelectId takes priority, then self-only auto-pick
        if (this.preSelectId) {
          this.applyPreSelect();
        } else if (this.isSelfOnlyMode && raw.length === 1) {
          // Auto-select the teacher's own record
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
    if (this.selected) this.teacherSelected.emit(this.selected);
  }

  onSelect(id: string) {
    this.selected = this.teachers.find(t => t.id === id) || null;
    if (this.selected) this.teacherSelected.emit(this.selected);
  }
}
