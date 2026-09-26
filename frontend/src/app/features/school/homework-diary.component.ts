import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

const API_BASE = 'http://localhost:5000/api';

export interface StudentHomeworkDto {
  id: string;
  tenantId: string;
  branchId?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  batchId?: string;
  batchName?: string;
  subjectId?: string;
  subjectName: string;
  teacherId?: string;
  teacherName?: string;
  title: string;
  description: string;
  assignedDate: string;
  dueDate: string;
  attachmentUrl?: string;
  status: string;
  estimatedMinutes?: number;
  createdAt: string;
}

export interface HomeworkStatsDto {
  totalActive: number;
  dueToday: number;
  assignedToday: number;
  completed: number;
}

@Component({
  selector: 'app-homework-diary',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule, MatProgressBarModule
  ],
  template: `
    <div class="hw-page-container">
      <!-- Page Header -->
      <div class="page-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>menu_book</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Digital Homework & Daily Classwork Diary</h1>
            <p class="page-subtitle">
              Manage subject homework assignments, submission due dates, instruction notes & classwork updates
            </p>
          </div>
        </div>

        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadHomework()" [disabled]="loading">
            <mat-icon [class.spin]="loading">refresh</mat-icon>
            <span>Refresh</span>
          </button>
          <button mat-raised-button class="create-btn" (click)="openHomeworkDialog()">
            <mat-icon>add_circle</mat-icon>
            <span>Assign Homework</span>
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon-wrap blue"><mat-icon>assignment</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.totalActive}}</div>
            <div class="stat-label">Active Assignments</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap amber"><mat-icon>alarm</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.dueToday}}</div>
            <div class="stat-label">Due Today</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap green"><mat-icon>today</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.assignedToday}}</div>
            <div class="stat-label">Assigned Today</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon-wrap purple"><mat-icon>task_alt</mat-icon></div>
          <div class="stat-details">
            <div class="stat-value">{{stats.completed}}</div>
            <div class="stat-label">Completed Tasks</div>
          </div>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-card">
        <div class="filter-row">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Filter by Class</mat-label>
            <mat-select [(ngModel)]="filterClassId" (selectionChange)="onClassChange()">
              <mat-option value="">All Classes</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field" *ngIf="availableSections.length > 0">
            <mat-label>Section</mat-label>
            <mat-select [(ngModel)]="filterSectionId" (selectionChange)="loadHomework()">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of availableSections" [value]="s.id">{{s.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadHomework()">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="Active">Active</mat-option>
              <mat-option value="Completed">Completed</mat-option>
              <mat-option value="Archived">Archived</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Search Title / Subject</mat-label>
            <input matInput [(ngModel)]="searchTerm" placeholder="Search..." (keyup.enter)="loadHomework()">
          </mat-form-field>

          <div class="view-toggle">
            <button mat-icon-button [class.active-view]="viewMode==='grid'" (click)="viewMode='grid'" matTooltip="Grid View">
              <mat-icon>grid_view</mat-icon>
            </button>
            <button mat-icon-button [class.active-view]="viewMode==='table'" (click)="viewMode='table'" matTooltip="Table View">
              <mat-icon>format_list_bulleted</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredItems.length === 0">
        <div class="empty-icon-wrap"><mat-icon>menu_book</mat-icon></div>
        <h3>No Homework Assigned</h3>
        <p>No homework tasks found matching the selected filters. Click "Assign Homework" to post a new entry.</p>
        <button mat-raised-button class="create-btn" (click)="openHomeworkDialog()">
          <mat-icon>add</mat-icon> Assign First Homework
        </button>
      </div>

      <!-- GRID VIEW -->
      <div class="hw-grid" *ngIf="!loading && viewMode==='grid' && filteredItems.length > 0">
        <div class="hw-card" *ngFor="let h of filteredItems">
          <div class="hw-card-top">
            <span class="subject-badge">{{h.subjectName || 'General'}}</span>
            <span class="status-pill" [ngClass]="h.status.toLowerCase()">{{h.status}}</span>
          </div>

          <h3 class="hw-title">{{h.title}}</h3>

          <div class="hw-meta-chips">
            <span class="meta-chip class-chip" *ngIf="h.className">
              <mat-icon>domain</mat-icon>
              {{h.className}}<span *ngIf="h.sectionName"> ({{h.sectionName}})</span>
            </span>
            <span class="meta-chip batch-chip" *ngIf="!h.className && h.batchName">
              <mat-icon>class</mat-icon> {{h.batchName}}
            </span>
            <span class="meta-chip teacher-chip" *ngIf="h.teacherName">
              <mat-icon>person</mat-icon> {{h.teacherName}}
            </span>
            <span class="meta-chip time-chip" *ngIf="h.estimatedMinutes">
              <mat-icon>timer</mat-icon> {{h.estimatedMinutes}} min
            </span>
          </div>

          <p class="hw-desc">{{h.description}}</p>

          <div class="hw-card-footer">
            <div class="hw-dates">
              <div class="date-item">
                <span class="date-lbl">Assigned:</span>
                <span class="date-val">{{h.assignedDate | date:'dd MMM yyyy, hh:mm a'}}</span>
              </div>
              <div class="date-item" [class.due-alert]="isDueSoon(h.dueDate)">
                <span class="date-lbl">Due:</span>
                <span class="date-val">{{h.dueDate | date:'dd MMM yyyy, hh:mm a'}}</span>
              </div>
            </div>

            <div class="hw-actions">
              <button mat-icon-button (click)="openHomeworkDialog(h)" matTooltip="Edit Assignment">
                <mat-icon class="action-ic edit">edit</mat-icon>
              </button>
              <button mat-icon-button (click)="toggleComplete(h)" [matTooltip]="h.status==='Completed'?'Mark Active':'Mark Complete'">
                <mat-icon class="action-ic complete" [class.done]="h.status==='Completed'">
                  {{h.status==='Completed' ? 'check_circle' : 'check_circle_outline'}}
                </mat-icon>
              </button>
              <button mat-icon-button (click)="deleteHomework(h)" matTooltip="Delete">
                <mat-icon class="action-ic delete">delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- TABLE VIEW -->
      <div class="hw-table-wrap" *ngIf="!loading && viewMode==='table' && filteredItems.length > 0">
        <table class="hw-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Title & Description</th>
              <th>Class / Section</th>
              <th>Teacher</th>
              <th>Assigned Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of filteredItems">
              <td>
                <span class="subject-badge">{{h.subjectName}}</span>
              </td>
              <td>
                <div class="tbl-title">{{h.title}}</div>
                <div class="tbl-desc">{{h.description}}</div>
              </td>
              <td>
                <span *ngIf="h.className">{{h.className}}<span *ngIf="h.sectionName"> - {{h.sectionName}}</span></span>
                <span *ngIf="!h.className && h.batchName">{{h.batchName}}</span>
              </td>
              <td>{{h.teacherName || '—'}}</td>
              <td>{{h.assignedDate | date:'dd MMM yyyy, hh:mm a'}}</td>
              <td>
                <span [class.due-alert-text]="isDueSoon(h.dueDate)">
                  {{h.dueDate | date:'dd MMM yyyy, hh:mm a'}}
                </span>
              </td>
              <td>
                <span class="status-pill" [ngClass]="h.status.toLowerCase()">{{h.status}}</span>
              </td>
              <td>
                <div class="tbl-actions">
                  <button mat-icon-button (click)="openHomeworkDialog(h)" matTooltip="Edit">
                    <mat-icon class="action-ic edit">edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="toggleComplete(h)" matTooltip="Toggle Status">
                    <mat-icon class="action-ic complete">{{h.status==='Completed'?'check_circle':'check_circle_outline'}}</mat-icon>
                  </button>
                  <button mat-icon-button (click)="deleteHomework(h)" matTooltip="Delete">
                    <mat-icon class="action-ic delete">delete</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .hw-page-container { padding: 24px; display: flex; flex-direction: column; gap: 20px; background: #f8fafc; min-height: 100vh; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; background: #fff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-box { width: 48px; height: 48px; border-radius: 12px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); }
    .page-title { margin: 0; font-size: 20px; font-weight: 800; color: #1e3a8a; }
    .page-subtitle { margin: 4px 0 0; font-size: 13px; color: #64748b; }
    .header-actions { display: flex; gap: 12px; align-items: center; }
    .create-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; padding: 0 20px; height: 42px; border-radius: 8px; }
    .refresh-btn { border-color: #cbd5e1; color: #475569; height: 42px; border-radius: 8px; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .stat-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .stat-icon-wrap { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon-wrap.blue { background: #eff6ff; color: #2563eb; }
    .stat-icon-wrap.amber { background: #fffbeb; color: #d97706; }
    .stat-icon-wrap.green { background: #f0fdf4; color: #16a34a; }
    .stat-icon-wrap.purple { background: #faf5ff; color: #9333ea; }
    .stat-value { font-size: 24px; font-weight: 800; color: #0f172a; line-height: 1.1; }
    .stat-label { font-size: 12px; font-weight: 600; color: #64748b; margin-top: 2px; }

    /* Filter Card */
    .filter-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .filter-row { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
    .filter-field { flex: 1; min-width: 180px; }
    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .view-toggle { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 8px; border: 1px solid #cbd5e1; }
    .view-toggle button { color: #64748b; border-radius: 6px; }
    .active-view { background: #fff !important; color: #2563eb !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

    /* Grid Layout */
    .hw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .hw-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.04); transition: transform 0.15s, box-shadow 0.15s; }
    .hw-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08); border-color: #cbd5e1; }
    .hw-card-top { display: flex; justify-content: space-between; align-items: center; }
    .subject-badge { background: #eff6ff; color: #1d4ed8; font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bfdbfe; }
    .status-pill { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; text-transform: capitalize; }
    .status-pill.active { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .status-pill.completed { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
    .status-pill.archived { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .hw-title { margin: 0; font-size: 15px; font-weight: 700; color: #1e293b; line-height: 1.3; }
    .hw-meta-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .meta-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    .meta-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .class-chip { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }
    .teacher-chip { background: #faf5ff; color: #7e22ce; border: 1px solid #f3e8ff; }
    .time-chip { background: #fffbeb; color: #b45309; border: 1px solid #fef3c7; }
    .hw-desc { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .hw-card-footer { margin-top: auto; border-top: 1px solid #f1f5f9; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .hw-dates { display: flex; flex-direction: column; gap: 2px; font-size: 11px; }
    .date-item { display: flex; gap: 6px; }
    .date-lbl { color: #94a3b8; font-weight: 600; }
    .date-val { color: #334155; font-weight: 700; }
    .due-alert .date-val { color: #dc2626; }
    .due-alert-text { color: #dc2626; font-weight: 700; }
    .hw-actions { display: flex; gap: 2px; }
    .action-ic { font-size: 18px; width: 18px; height: 18px; }
    .action-ic.edit { color: #2563eb; }
    .action-ic.complete { color: #16a34a; }
    .action-ic.complete.done { color: #059669; }
    .action-ic.delete { color: #ef4444; }

    /* Table Layout */
    .hw-table-wrap { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .hw-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; }
    .hw-table th { background: #f8fafc; color: #475569; font-weight: 700; padding: 14px 16px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .hw-table td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
    .hw-table tr:hover { background: #f8fafc; }
    .tbl-title { font-weight: 700; color: #1e293b; }
    .tbl-desc { font-size: 12px; color: #64748b; margin-top: 2px; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tbl-actions { display: flex; gap: 4px; }

    /* Empty state */
    .empty-state { background: #fff; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 60px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .empty-icon-wrap { width: 64px; height: 64px; border-radius: 50%; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
    .empty-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .empty-state h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
    .empty-state p { margin: 0; font-size: 13px; color: #64748b; max-width: 400px; }
  `]
})
export class HomeworkDiaryComponent implements OnInit {
  homeworkList: StudentHomeworkDto[] = [];
  classes: any[] = [];
  availableSections: any[] = [];
  teachers: any[] = [];
  subjects: any[] = [];

  loading = false;
  viewMode: 'grid' | 'table' = 'grid';

  filterClassId = '';
  filterSectionId = '';
  filterStatus = '';
  searchTerm = '';

  stats: HomeworkStatsDto = {
    totalActive: 0,
    dueToday: 0,
    assignedToday: 0,
    completed: 0
  };

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadTeachers();
    this.loadSubjects();
    this.loadStats();
    this.loadHomework();
  }

  loadClasses(): void {
    this.http.get<any[]>(`${API_BASE}/school/classes`).subscribe({
      next: r => this.classes = r,
      error: () => this.classes = []
    });
  }

  loadTeachers(): void {
    this.http.get<any[]>(`${API_BASE}/teachers`).subscribe({
      next: r => this.teachers = r,
      error: () => this.teachers = []
    });
  }

  loadSubjects(): void {
    this.http.get<any[]>(`${API_BASE}/subjects`).subscribe({
      next: r => this.subjects = r,
      error: () => this.subjects = []
    });
  }

  onClassChange(): void {
    this.filterSectionId = '';
    const found = this.classes.find(c => c.id === this.filterClassId);
    this.availableSections = found?.sections || [];
    this.loadHomework();
  }

  loadStats(): void {
    this.http.get<HomeworkStatsDto>(`${API_BASE}/homework/stats`).subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadHomework(): void {
    this.loading = true;
    let url = `${API_BASE}/homework`;
    const params: string[] = [];
    if (this.filterClassId) params.push(`classId=${this.filterClassId}`);
    if (this.filterSectionId) params.push(`sectionId=${this.filterSectionId}`);
    if (this.filterStatus) params.push(`status=${this.filterStatus}`);
    if (params.length > 0) url += '?' + params.join('&');

    this.http.get<StudentHomeworkDto[]>(url).subscribe({
      next: r => {
        this.homeworkList = r;
        this.loading = false;
        this.loadStats();
      },
      error: () => {
        this.homeworkList = [];
        this.loading = false;
      }
    });
  }

  get filteredItems(): StudentHomeworkDto[] {
    if (!this.searchTerm.trim()) return this.homeworkList;
    const s = this.searchTerm.toLowerCase().trim();
    return this.homeworkList.filter(h =>
      h.title.toLowerCase().includes(s) ||
      h.subjectName.toLowerCase().includes(s) ||
      h.description.toLowerCase().includes(s)
    );
  }

  isDueSoon(dueDate: string): boolean {
    if (!dueDate) return false;
    const due = new Date(dueDate).getTime();
    const now = Date.now();
    const diffHours = (due - now) / (1000 * 3600);
    return diffHours <= 24;
  }

  openHomeworkDialog(item?: StudentHomeworkDto): void {
    const ref = this.dialog.open(HomeworkFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: false,
      data: {
        homework: item,
        classes: this.classes,
        teachers: this.teachers,
        subjects: this.subjects
      }
    });

    ref.afterClosed().subscribe((res: any) => {
      if (!res) return;
      this.loadHomework();
      if (res.action === 'created') {
        this.confirmDialog.alert(
          'Homework Assigned 🎉',
          `Homework "${res.title}" has been assigned and published successfully!`,
          'success'
        );
      } else if (res.action === 'updated') {
        this.confirmDialog.alert(
          'Homework Updated 🎉',
          `Assignment "${res.title}" details updated successfully!`,
          'success'
        );
      }
    });
  }

  toggleComplete(h: StudentHomeworkDto): void {
    const newStatus = h.status === 'Completed' ? 'Active' : 'Completed';
    this.http.put(`${API_BASE}/homework/${h.id}`, {
      title: h.title,
      description: h.description,
      dueDate: h.dueDate,
      status: newStatus,
      attachmentUrl: h.attachmentUrl,
      estimatedMinutes: h.estimatedMinutes
    }).subscribe({
      next: () => {
        this.loadHomework();
        this.confirmDialog.alert(
          'Status Updated',
          `Homework "${h.title}" marked as ${newStatus}.`,
          'success'
        );
      },
      error: () => this.confirmDialog.alert('Error', 'Failed to update status.', 'danger')
    });
  }

  deleteHomework(h: StudentHomeworkDto): void {
    this.confirmDialog.confirm(
      'Delete Homework Assignment',
      `Are you sure you want to permanently delete "${h.title}"?`,
      'Delete Assignment',
      'Cancel',
      'danger'
    ).subscribe(ok => {
      if (!ok) return;
      this.http.delete(`${API_BASE}/homework/${h.id}`).subscribe({
        next: () => {
          this.loadHomework();
          this.confirmDialog.alert('Homework Deleted', 'The homework assignment has been deleted.', 'success');
        },
        error: () => this.confirmDialog.alert('Error', 'Failed to delete homework.', 'danger')
      });
    });
  }
}

// =========================================================================
// Homework Form Dialog Component (Strict AGENTS.md light-blue header)
// =========================================================================

@Component({
  selector: 'app-homework-form-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule
  ],
  template: `
    <div class="hw-dialog-wrap">
      <!-- Strict AGENTS.md Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>{{isEdit ? 'edit_note' : 'post_add'}}</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">{{isEdit ? 'Edit Homework Assignment' : 'Assign New Homework'}}</h2>
            <p class="modal-subtitle">
              <strong style="color:#1e40af">{{isEdit ? model.title : 'School & Coaching Daily Diary'}}</strong>
              <span> &bull; Post instructions and submission deadlines</span>
            </p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Form Body -->
      <div class="modal-body">
        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Class (कक्षा)</mat-label>
            <mat-select [(ngModel)]="model.classId" (selectionChange)="onClassSelect()">
              <mat-option *ngFor="let c of data.classes" [value]="c.id">{{c.name}}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field" *ngIf="dialogSections.length > 0">
            <mat-label>Section (वर्ग)</mat-label>
            <mat-select [(ngModel)]="model.sectionId">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of dialogSections" [value]="s.id">{{s.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Subject (विषय)</mat-label>
            <mat-select [(ngModel)]="model.subjectName">
              <mat-option value="Mathematics">Mathematics</mat-option>
              <mat-option value="Science">Science</mat-option>
              <mat-option value="English">English</mat-option>
              <mat-option value="Hindi">Hindi</mat-option>
              <mat-option value="Social Science">Social Science</mat-option>
              <mat-option value="Physics">Physics</mat-option>
              <mat-option value="Chemistry">Chemistry</mat-option>
              <mat-option value="Biology">Biology</mat-option>
              <mat-option value="Computer">Computer</mat-option>
              <mat-option value="General">General / All Subjects</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Teacher Incharge</mat-label>
            <mat-select [(ngModel)]="model.teacherId" (selectionChange)="onTeacherSelect()">
              <mat-option value="">Select Teacher</mat-option>
              <mat-option *ngFor="let t of data.teachers" [value]="t.id">{{t.fullName || t.name}}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Homework Title / Chapter (शीर्षक / अध्याय)</mat-label>
          <input matInput [(ngModel)]="model.title" placeholder="e.g. Chapter 4: Quadratic Equations - Ex 4.2 Q1 to Q5" required />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Instructions & Work Details (निर्देश एवं विवरण)</mat-label>
          <textarea matInput [(ngModel)]="model.description" rows="4" placeholder="Detail the questions to solve, textbook pages, diagrams or notes to prepare..." required></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Submission Due Date & Time (IST) *</mat-label>
            <input matInput type="datetime-local" [(ngModel)]="dueDateStr" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field">
            <mat-label>Est. Duration (Minutes)</mat-label>
            <input matInput type="number" [(ngModel)]="model.estimatedMinutes" placeholder="30" />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-field">
          <mat-label>Reference Link / Video / Doc URL (Optional)</mat-label>
          <input matInput [(ngModel)]="model.attachmentUrl" placeholder="https://..." />
        </mat-form-field>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button mat-button (click)="dialogRef.close(false)" class="cancel-btn">Cancel</button>
        <button mat-raised-button class="save-btn" (click)="saveHomework()" [disabled]="saving || !model.title || !model.description">
          <mat-icon>{{isEdit ? 'save' : 'send'}}</mat-icon>
          <span>{{isEdit ? 'Save Changes' : 'Assign Homework'}}</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .hw-dialog-wrap { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    /* Strict AGENTS.md Header */
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }

    .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 14px; max-height: 70vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; }
    .form-field { flex: 1; }
    .full-field { width: 100%; }
    .modal-footer { padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .cancel-btn { color: #64748b; }
    .save-btn { background: #2563eb !important; color: #fff !important; font-weight: 700; }
  `]
})
export class HomeworkFormDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  dialogSections: any[] = [];
  dueDateStr = '';

  model: any = {
    classId: '',
    sectionId: '',
    batchId: '',
    subjectName: 'Mathematics',
    teacherId: '',
    teacherName: '',
    title: '',
    description: '',
    dueDate: '',
    attachmentUrl: '',
    estimatedMinutes: 30
  };

  constructor(
    public dialogRef: MatDialogRef<HomeworkFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  private formatLocalIsoDatetime(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = d.getDate();
    const h = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  ngOnInit(): void {
    if (this.data?.homework) {
      this.isEdit = true;
      const h = this.data.homework;
      this.model = { ...h };
      if (h.dueDate) {
        this.dueDateStr = h.dueDate.replace(' ', 'T').slice(0, 16);
      }
      this.onClassSelect();
    } else {
      // Default due date tomorrow at 5:00 PM IST (17:00)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(17, 0, 0, 0);
      this.dueDateStr = this.formatLocalIsoDatetime(tomorrow);
    }
  }

  onClassSelect(): void {
    const found = this.data.classes?.find((c: any) => c.id === this.model.classId);
    this.dialogSections = found?.sections || [];
  }

  onTeacherSelect(): void {
    const t = this.data.teachers?.find((x: any) => x.id === this.model.teacherId);
    if (t) this.model.teacherName = t.fullName || t.name;
  }

  saveHomework(): void {
    const cleanDueDate = this.dueDateStr ? (this.dueDateStr.length === 16 ? this.dueDateStr + ':00' : this.dueDateStr) : null;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const assignedDateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    this.saving = true;
    if (this.isEdit) {
      this.http.put(`${API_BASE}/homework/${this.model.id}`, {
        title: this.model.title,
        description: this.model.description,
        dueDate: cleanDueDate,
        status: this.model.status || 'Active',
        attachmentUrl: this.model.attachmentUrl,
        estimatedMinutes: this.model.estimatedMinutes
      }).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'updated', title: this.model.title });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Save Failed', 'Failed to update homework assignment.', 'danger');
        }
      });
    } else {
      this.http.post(`${API_BASE}/homework`, {
        classId: this.model.classId || null,
        sectionId: this.model.sectionId || null,
        batchId: this.model.batchId || null,
        subjectName: this.model.subjectName,
        teacherId: this.model.teacherId || null,
        teacherName: this.model.teacherName || null,
        title: this.model.title,
        description: this.model.description,
        assignedDate: assignedDateStr,
        dueDate: cleanDueDate,
        attachmentUrl: this.model.attachmentUrl,
        estimatedMinutes: this.model.estimatedMinutes
      }).subscribe({
        next: () => {
          this.saving = false;
          this.dialogRef.close({ action: 'created', title: this.model.title });
        },
        error: () => {
          this.saving = false;
          this.confirmDialog.alert('Creation Failed', 'Failed to create homework assignment.', 'danger');
        }
      });
    }
  }
}
