import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BatchDto, TeacherDto } from './teacher.models';

export interface QuickAssignDialogData {
  batch: BatchDto;
  teachers: TeacherDto[];
}

@Component({
  selector: 'app-teacher-quick-assign-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule
  ],
  template: `
<div class="quick-assign-modal">
  <!-- Strict UI Compliant Light-Blue Gradient Header -->
  <div class="modal-header">
    <div class="header-left">
      <div class="header-icon-box">
        <mat-icon>person_add</mat-icon>
      </div>
      <div>
        <h2 class="modal-title">{{data.batch.category === 'School' ? 'Assign Faculty to School Class' : 'Assign Faculty to Coaching Batch'}}</h2>
        <p class="modal-subtitle">
          <span class="dialog-scope-badge" [class.school-badge]="data.batch.category === 'School'" [class.coaching-badge]="data.batch.category !== 'School'">
            {{data.batch.category === 'School' ? '🏫 School Class' : '🎯 Coaching Batch'}}
          </span>
          &nbsp;&bull;&nbsp;<strong>{{data.batch.name}}</strong> &bull; Subject: <strong>{{data.batch.subject || 'General'}}</strong>
        </p>
      </div>
    </div>
    <button mat-icon-button class="close-btn" (click)="onCancel()" matTooltip="Close dialog">
      <mat-icon>close</mat-icon>
    </button>
  </div>

  <div class="modal-body">
    <!-- Batch Info Strip -->
    <div class="batch-summary-strip">
      <div class="strip-item">
        <span class="label">Batch Name</span>
        <span class="val font-bold">{{data.batch.name}}</span>
      </div>
      <div class="strip-item">
        <span class="label">Subject</span>
        <span class="val subject-pill">{{data.batch.subject || 'Unspecified'}}</span>
      </div>
      <div class="strip-item">
        <span class="label">Enrolled Students</span>
        <span class="val">{{data.batch.studentCount || 0}} Students</span>
      </div>
      <div class="strip-item" *ngIf="data.batch.academicYear">
        <span class="label">Academic Year</span>
        <span class="val">{{data.batch.academicYear}}</span>
      </div>
    </div>

    <!-- Search Faculty -->
    <div class="teacher-search-box">
      <mat-icon class="search-icon">search</mat-icon>
      <input type="text" [(ngModel)]="searchQuery" placeholder="Search teacher by name, employee code, or specialization..." />
      <button type="button" class="clear-btn" *ngIf="searchQuery" (click)="searchQuery = ''">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <!-- Teachers List -->
    <div class="teachers-list-container">
      <div class="list-title-row">
        <span class="list-title">Select Faculty ({{filteredTeachers.length}} Available):</span>
        <span class="subject-match-hint" *ngIf="data.batch.subject">
          💡 Faculty with matching subject specialization highlighted
        </span>
      </div>

      <div class="teachers-scroll">
        <div *ngFor="let t of filteredTeachers"
          class="teacher-option-card"
          [class.selected]="selectedTeacher?.id === t.id"
          [class.specialist-match]="isSubjectMatch(t)"
          (click)="selectedTeacher = t">
          
          <div class="t-radio">
            <div class="radio-circle" [class.checked]="selectedTeacher?.id === t.id">
              <div class="inner-dot" *ngIf="selectedTeacher?.id === t.id"></div>
            </div>
          </div>

          <div class="t-avatar">
            {{t.fullName.charAt(0) | uppercase}}
          </div>

          <div class="t-details">
            <div class="t-name-row">
              <span class="t-name">{{t.fullName}}</span>
              <span class="t-code">{{t.employeeCode}}</span>
              <span class="match-badge" *ngIf="isSubjectMatch(t)">
                <mat-icon>verified</mat-icon> Subject Match
              </span>
            </div>
            <div class="t-meta-row">
              <span class="t-spec" *ngIf="t.specialization">
                <mat-icon>school</mat-icon> {{t.specialization}}
              </span>
              <span class="t-exp" *ngIf="t.experienceYears">
                {{t.experienceYears}} yrs exp
              </span>
              <span class="t-phone" *ngIf="t.phoneNumber">
                <mat-icon>call</mat-icon> {{t.phoneNumber}}
              </span>
            </div>
          </div>
        </div>

        <div class="no-teachers-found" *ngIf="filteredTeachers.length === 0">
          <mat-icon>person_off</mat-icon>
          <p>No faculty found matching "{{searchQuery}}"</p>
        </div>
      </div>
    </div>
  </div>

  <div class="modal-footer">
    <button mat-button class="cancel-btn" (click)="onCancel()">Cancel</button>
    <button mat-raised-button color="primary" class="proceed-btn" [disabled]="!selectedTeacher" (click)="onConfirm()">
      <mat-icon>check_circle</mat-icon>
      Assign to {{selectedTeacher ? selectedTeacher.fullName : 'Selected Teacher'}} & Configure Timetable
    </button>
  </div>
</div>
  `,
  styles: [`
    .quick-assign-modal { display: flex; flex-direction: column; max-height: 85vh; }
    
    /* Strict AGENTS.md light-blue gradient header */
    .modal-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 12px 12px 0 0;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box {
      background: #2563eb;
      color: #ffffff;
      border-radius: 10px;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .modal-title { color: #1e3a8a; font-weight: 700; font-size: 1.15rem; margin: 0; }
    .modal-subtitle { color: #3b82f6; font-size: .84rem; margin: 2px 0 0; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
      strong { color: #1e40af; } }
    .dialog-scope-badge {
      font-size: .72rem;
      font-weight: 700;
      padding: 1px 7px;
      border-radius: 6px;
      display: inline-block;
      &.school-badge { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
      &.coaching-badge { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    }
    .close-btn { color: #64748b; &:hover { color: #1e293b; } }

    .modal-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }

    .batch-summary-strip {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .strip-item { display: flex; flex-direction: column; gap: 2px; }
    .strip-item .label { font-size: .72rem; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .strip-item .val { font-size: .88rem; color: #1e293b; }
    .font-bold { font-weight: 700; }
    .subject-pill {
      background: #e0f2fe;
      color: #0369a1;
      padding: 1px 8px;
      border-radius: 12px;
      font-weight: 600;
      font-size: .8rem;
    }

    .teacher-search-box {
      display: flex;
      align-items: center;
      background: #fff;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 12px;
      gap: 8px;
      transition: border-color .15s;
      &:focus-within { border-color: #2563eb; }
      .search-icon { color: #64748b; font-size: 20px; width: 20px; height: 20px; }
      input {
        border: none;
        outline: none;
        width: 100%;
        font-size: .88rem;
        color: #1e293b;
        background: transparent;
      }
      .clear-btn { border: none; background: transparent; cursor: pointer; color: #94a3b8; padding: 0;
        mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    }

    .teachers-list-container { display: flex; flex-direction: column; gap: 8px; }
    .list-title-row { display: flex; justify-content: space-between; align-items: center; font-size: .82rem; }
    .list-title { font-weight: 700; color: #334155; }
    .subject-match-hint { color: #16a34a; font-weight: 600; font-size: .75rem; }

    .teachers-scroll {
      max-height: 280px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
    }

    .teacher-option-card {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: all .15s ease;
      &:hover { border-color: #93c5fd; background: #f8fafc; }
      &.selected { border-color: #2563eb; background: #eff6ff; }
      &.specialist-match { border-left: 4px solid #16a34a; }
    }

    .radio-circle {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      display: flex;
      align-items: center;
      justify-content: center;
      &.checked { border-color: #2563eb; }
    }
    .inner-dot { width: 9px; height: 9px; border-radius: 50%; background: #2563eb; }

    .t-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #e2e8f0;
      color: #334155;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: .9rem;
    }
    .teacher-option-card.selected .t-avatar { background: #2563eb; color: #fff; }

    .t-details { display: flex; flex-direction: column; gap: 2px; flex: 1; }
    .t-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .t-name { font-weight: 700; font-size: .9rem; color: #1e293b; }
    .t-code { background: #f1f5f9; color: #475569; font-size: .72rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; }
    .match-badge {
      display: flex;
      align-items: center;
      gap: 3px;
      background: #dcfce7;
      color: #166534;
      font-size: .7rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }

    .t-meta-row { display: flex; align-items: center; gap: 10px; font-size: .78rem; color: #64748b; flex-wrap: wrap;
      span { display: flex; align-items: center; gap: 3px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; } } }

    .no-teachers-found {
      text-align: center;
      padding: 30px 10px;
      color: #94a3b8;
      mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 6px; }
      p { margin: 0; font-size: .88rem; }
    }

    .modal-footer {
      border-top: 1px solid #e2e8f0;
      padding: 14px 20px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      background: #f8fafc;
      border-radius: 0 0 12px 12px;
    }
    .cancel-btn { font-weight: 600; color: #64748b; }
    .proceed-btn { font-weight: 700; border-radius: 8px; }
  `]
})
export class TeacherQuickAssignDialogComponent implements OnInit {
  searchQuery = '';
  selectedTeacher: TeacherDto | null = null;

  constructor(
    public dialogRef: MatDialogRef<TeacherQuickAssignDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QuickAssignDialogData
  ) {}

  ngOnInit() {
    // If there's an exact specialization match, preselect or highlight
    const match = this.data.teachers.find(t => this.isSubjectMatch(t));
    if (match) {
      this.selectedTeacher = match;
    } else if (this.data.teachers.length > 0) {
      this.selectedTeacher = this.data.teachers[0];
    }
  }

  isSubjectMatch(teacher: TeacherDto): boolean {
    if (!this.data.batch.subject || !teacher.specialization) return false;
    const batchSub = this.data.batch.subject.toLowerCase();
    const spec = teacher.specialization.toLowerCase();
    return spec.includes(batchSub) || batchSub.includes(spec);
  }

  get filteredTeachers(): TeacherDto[] {
    if (!this.data.teachers) return [];
    let list = this.data.teachers.filter(t => t.isActive);
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(t => 
        t.fullName.toLowerCase().includes(q) ||
        t.employeeCode.toLowerCase().includes(q) ||
        (t.specialization && t.specialization.toLowerCase().includes(q))
      );
    }
    // Sort so subject matches come first, then alphabetical
    list.sort((a, b) => {
      const aMatch = this.isSubjectMatch(a) ? 1 : 0;
      const bMatch = this.isSubjectMatch(b) ? 1 : 0;
      if (bMatch !== aMatch) return bMatch - aMatch;
      return a.fullName.localeCompare(b.fullName);
    });
    return list;
  }

  onCancel() {
    this.dialogRef.close();
  }

  onConfirm() {
    if (this.selectedTeacher) {
      this.dialogRef.close({ teacher: this.selectedTeacher });
    }
  }
}
