import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { API_BASE, TeacherDto } from './teacher.models';

@Component({
  selector: 'app-teacher-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatCardModule],
  template: `
    <mat-card class="selector-card mat-elevation-z1">
      <div class="selector-row">
        <mat-icon color="primary" class="selector-icon">person_search</mat-icon>
        <mat-form-field appearance="outline" class="selector-field">
          <mat-label>Teacher Select Karo</mat-label>
          <mat-select [(ngModel)]="selectedId" (ngModelChange)="onSelect($event)">
            <mat-option *ngFor="let t of teachers" [value]="t.id">
              <span class="opt-code">{{t.employeeCode}}</span>
              &nbsp;–&nbsp;{{t.fullName}}
              <span class="opt-dot" [class.active]="t.isActive" [class.inactive]="!t.isActive"></span>
            </mat-option>
          </mat-select>
        </mat-form-field>
        <div class="teacher-quick" *ngIf="selected">
          <mat-icon>school</mat-icon>
          <span>{{selected.specialization || 'No Specialization'}}</span>
          <mat-icon style="margin-left:12px">phone</mat-icon>
          <span>{{selected.phoneNumber}}</span>
          <span class="exp-badge">{{selected.experienceYears}} yrs exp</span>
        </div>
      </div>
    </mat-card>
  `,
  styles: [`
    .selector-card { padding: 14px 20px; border-radius: 10px; background: #f0f7ff; border: 1px solid #bbdefb; }
    .selector-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .selector-icon { font-size: 28px; width: 28px; height: 28px; }
    .selector-field { flex: 1; min-width: 260px; max-width: 380px; }
    .teacher-quick { display: flex; align-items: center; gap: 6px; font-size: .85rem; color: #334155; flex-wrap: wrap;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1976d2; } }
    .exp-badge { background: #e3f2fd; color: #1565c0; font-size: .72rem; padding: 2px 8px; border-radius: 10px; font-weight: 700; margin-left: 8px; }
    .opt-code { font-weight: 700; color: #1976d2; }
    .opt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 6px; vertical-align: middle;
      &.active { background: #4caf50; } &.inactive { background: #f44336; } }
  `]
})
export class TeacherSelectorComponent implements OnInit, OnChanges {
  @Input() preSelectId: string | null = null;
  @Input() activeOnly: boolean = true;
  @Output() teacherSelected = new EventEmitter<TeacherDto>();

  teachers: TeacherDto[] = [];
  selectedId: string = '';
  selected: TeacherDto | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    const url = this.activeOnly
      ? `${API_BASE}/teachers/paged?pageSize=500&sortBy=fullName&isActive=true`
      : `${API_BASE}/teachers/paged?pageSize=500&sortBy=fullName`;

    this.http.get<any>(url).subscribe({
      next: r => {
        this.teachers = r.items || [];
        if (this.preSelectId) this.applyPreSelect();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['preSelectId'] && this.teachers.length > 0) {
      this.applyPreSelect();
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
