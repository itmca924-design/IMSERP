import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { API_BASE, HolidayDto } from '../teachers/teacher.models';

@Component({
  selector: 'app-holidays',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title"><mat-icon>event</mat-icon> Holiday Master & Academic Calendar</h1>
          <p class="page-subtitle">Configure institutional holidays, national festivals, and recess days mapped directly to faculty attendance and student schedules.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openAddForm()">
          <mat-icon>add</mat-icon>
          <span>Add New Holiday</span>
        </button>
      </div>

      <!-- Summary KPI Badges -->
      <div class="kpi-grid">
        <div class="kpi-card total">
          <div class="kpi-icon"><mat-icon>calendar_month</mat-icon></div>
          <div class="kpi-data">
            <span class="val">{{ holidays.length }}</span>
            <small>Total Declared</small>
          </div>
        </div>

        <div class="kpi-card national">
          <div class="kpi-icon"><mat-icon>flag</mat-icon></div>
          <div class="kpi-data">
            <span class="val">{{ countByType('National') }}</span>
            <small>National Holidays</small>
          </div>
        </div>

        <div class="kpi-card festival">
          <div class="kpi-icon"><mat-icon>celebration</mat-icon></div>
          <div class="kpi-data">
            <span class="val">{{ countByType('Festival') }}</span>
            <small>Festivals</small>
          </div>
        </div>

        <div class="kpi-card academic">
          <div class="kpi-icon"><mat-icon>school</mat-icon></div>
          <div class="kpi-data">
            <span class="val">{{ countByType('Academic') + countByType('Institutional') }}</span>
            <small>Academic / Recess</small>
          </div>
        </div>
      </div>

      <!-- Add/Edit Drawer Card -->
      <mat-card class="form-drawer-card mat-elevation-z2" *ngIf="showForm">
        <div class="form-header">
          <div class="form-header-title">
            <mat-icon color="primary">{{ isEditing ? 'edit_calendar' : 'add_circle' }}</mat-icon>
            <div>
              <strong>{{ isEditing ? 'Edit Holiday Record' : 'Declare New Holiday / Vacation' }}</strong>
              <p>Holidays automatically synchronize with the faculty attendance register and payroll engine.</p>
            </div>
          </div>
          <button mat-icon-button (click)="closeForm()">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <div class="form-grid">
          <mat-form-field appearance="outline" class="form-field-title">
            <mat-label>Holiday Title *</mat-label>
            <input matInput [(ngModel)]="formData.title" placeholder="e.g. Republic Day, Holi, Diwali Break" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field-type">
            <mat-label>Holiday Category *</mat-label>
            <mat-select [(ngModel)]="formData.holidayType">
              <mat-option value="National">National Holiday</mat-option>
              <mat-option value="Festival">Festival Break</mat-option>
              <mat-option value="Academic">Academic Recess</mat-option>
              <mat-option value="Institutional">Institutional Off</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field-date">
            <mat-label>Start Date *</mat-label>
            <input matInput type="date" [(ngModel)]="formData.startDate" (ngModelChange)="onStartDateChange()" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field-date">
            <mat-label>End Date *</mat-label>
            <input matInput type="date" [(ngModel)]="formData.endDate" required />
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field-desc">
            <mat-label>Description / Notice (Optional)</mat-label>
            <input matInput [(ngModel)]="formData.description" placeholder="e.g. Institute and library remain closed." />
          </mat-form-field>
        </div>

        <div class="form-footer">
          <mat-slide-toggle [(ngModel)]="formData.isActive" color="primary">
            Active Holiday
          </mat-slide-toggle>
          <div class="btn-group">
            <button mat-button (click)="closeForm()">Cancel</button>
            <button mat-raised-button color="primary" (click)="saveHoliday()" [disabled]="!formData.title || !formData.startDate || !formData.endDate || saving">
              <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
              {{ isEditing ? 'Update Holiday' : 'Save Holiday' }}
            </button>
          </div>
        </div>
      </mat-card>

      <!-- Main Directory Card -->
      <mat-card class="table-card mat-elevation-z1">
        <!-- Filter Toolbar -->
        <div class="filter-toolbar">
          <div class="filter-group">
            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Academic Year</mat-label>
              <mat-select [(ngModel)]="selectedYear" (selectionChange)="loadHolidays()">
                <mat-option [value]="0">All Years</mat-option>
                <mat-option [value]="2025">2025</mat-option>
                <mat-option [value]="2026">2026</mat-option>
                <mat-option [value]="2027">2027</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Month</mat-label>
              <mat-select [(ngModel)]="selectedMonth" (selectionChange)="loadHolidays()">
                <mat-option [value]="0">All Months</mat-option>
                <mat-option *ngFor="let m of months; let i = index" [value]="i + 1">{{ m }}</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="filter-select">
              <mat-label>Category Filter</mat-label>
              <mat-select [(ngModel)]="selectedType" (selectionChange)="applyFilter()">
                <mat-option value="">All Categories</mat-option>
                <mat-option value="National">National</mat-option>
                <mat-option value="Festival">Festival</mat-option>
                <mat-option value="Academic">Academic</mat-option>
                <mat-option value="Institutional">Institutional</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="search-wrap">
            <mat-form-field appearance="outline" class="search-input">
              <mat-label>Search holidays...</mat-label>
              <input matInput [(ngModel)]="searchKeyword" (ngModelChange)="applyFilter()" placeholder="Search by title or description" />
              <button mat-icon-button matSuffix *ngIf="searchKeyword" (click)="searchKeyword = ''; applyFilter()">
                <mat-icon>close</mat-icon>
              </button>
            </mat-form-field>
          </div>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <!-- Table View -->
        <div class="table-responsive" *ngIf="filteredHolidays.length > 0">
          <table class="holiday-table">
            <thead>
              <tr>
                <th>Date & Schedule</th>
                <th>Holiday Title</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Description / Notes</th>
                <th>Status</th>
                <th class="actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredHolidays">
                <td class="date-cell">
                  <div class="date-box">
                    <span class="day-num">{{ formatDayNum(item.startDate) }}</span>
                    <div class="date-meta">
                      <span class="month-yr">{{ formatMonthYear(item.startDate) }}</span>
                      <span class="day-name">{{ formatDayName(item.startDate) }}</span>
                    </div>
                  </div>
                  <div *ngIf="item.startDate.split('T')[0] !== item.endDate.split('T')[0]" class="range-hint">
                    to {{ formatShortDate(item.endDate) }}
                  </div>
                </td>
                <td class="title-cell">
                  <strong>{{ item.title }}</strong>
                </td>
                <td>
                  <span class="type-badge" [ngClass]="item.holidayType.toLowerCase()">
                    {{ item.holidayType }}
                  </span>
                </td>
                <td>
                  <span class="duration-badge">{{ calculateDuration(item.startDate, item.endDate) }}</span>
                </td>
                <td class="desc-cell">
                  {{ item.description || '—' }}
                </td>
                <td>
                  <span class="status-pill" [class.active]="item.isActive" [class.inactive]="!item.isActive">
                    {{ item.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button mat-icon-button color="primary" matTooltip="Edit Holiday" (click)="editHoliday(item)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" matTooltip="Delete Holiday" (click)="deleteHoliday(item)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="filteredHolidays.length === 0 && !loading">
          <mat-icon>event_busy</mat-icon>
          <h3>No Holidays Found</h3>
          <p>No holiday records matched your filter criteria. Click "Add New Holiday" to declare a holiday or reset your filters.</p>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { display: flex; flex-direction: column; gap: 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
    .page-title {
      font-size: 1.5rem; font-weight: 700; margin: 0; color: #1976d2; display: flex; align-items: center; gap: 8px;
      mat-icon { font-size: 1.6rem; width: 1.6rem; height: 1.6rem; }
    }
    .page-subtitle { color: #64748b; margin: 4px 0 0; font-size: 0.9rem; max-width: 800px; }
    .add-btn { font-weight: 600; border-radius: 8px; display: flex; align-items: center; gap: 6px; }

    /* KPI Summary Cards */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
    .kpi-card {
      background: #ffffff; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .kpi-icon {
      width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
      mat-icon { font-size: 24px; width: 24px; height: 24px; }
    }
    .kpi-data {
      .val { display: block; font-size: 1.5rem; font-weight: 800; line-height: 1.1; color: #0f172a; }
      small { font-size: 0.76rem; font-weight: 600; color: #64748b; }
    }
    .kpi-card.total .kpi-icon { background: #eff6ff; color: #2563eb; }
    .kpi-card.national .kpi-icon { background: #fef2f2; color: #dc2626; }
    .kpi-card.festival .kpi-icon { background: #faf5ff; color: #9333ea; }
    .kpi-card.academic .kpi-icon { background: #f0fdf4; color: #16a34a; }

    /* Form Drawer */
    .form-drawer-card { padding: 20px; border-radius: 12px; border: 1px solid #cbd5e1; background: #ffffff; display: flex; flex-direction: column; gap: 16px; }
    .form-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
    .form-header-title {
      display: flex; align-items: center; gap: 12px;
      strong { font-size: 1.05rem; color: #0f172a; display: block; }
      p { margin: 2px 0 0; font-size: 0.82rem; color: #64748b; }
    }
    .form-grid { display: flex; flex-wrap: wrap; gap: 14px; }
    .form-field-title { flex: 2; min-width: 220px; }
    .form-field-type { flex: 1.2; min-width: 170px; }
    .form-field-date { flex: 1; min-width: 150px; }
    .form-field-desc { flex: 3; min-width: 260px; }

    .form-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 14px; }
    .btn-group { display: flex; gap: 12px; }

    /* Main Table Card */
    .table-card { border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; padding: 0; background: #ffffff; }
    .filter-toolbar {
      padding: 14px 20px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .filter-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filter-select { width: 145px; margin-bottom: -1.25em; }
    .search-wrap { margin-bottom: -1.25em; }
    .search-input { width: 260px; }

    .table-responsive { overflow-x: auto; }
    .holiday-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .holiday-table th, .holiday-table td { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; text-align: left; }
    .holiday-table th { background: #f8fafc; font-weight: 700; color: #64748b; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.4px; }
    .holiday-table tr:hover td { background: #fbfcfd; }

    .date-box { display: flex; align-items: center; gap: 10px; }
    .day-num {
      font-size: 1.3rem; font-weight: 800; color: #1e293b; background: #f1f5f9;
      width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    }
    .date-meta {
      display: flex; flex-direction: column;
      .month-yr { font-weight: 700; font-size: 0.85rem; color: #0f172a; }
      .day-name { font-size: 0.72rem; color: #64748b; font-weight: 600; }
    }
    .range-hint { font-size: 0.74rem; color: #2563eb; font-weight: 600; margin-top: 3px; }

    .title-cell strong { font-size: 0.94rem; color: #0f172a; }

    .type-badge {
      padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px;
      &.national { background: #fee2e2; color: #b91c1c; }
      &.festival { background: #f3e8ff; color: #7e22ce; }
      &.academic { background: #dbeafe; color: #1d4ed8; }
      &.institutional { background: #dcfce7; color: #15803d; }
    }

    .duration-badge { background: #f1f5f9; color: #334155; padding: 2px 8px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; }
    .desc-cell { color: #64748b; max-width: 250px; font-size: 0.82rem; }

    .status-pill {
      padding: 3px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 700;
      &.active { background: #dcfce7; color: #15803d; }
      &.inactive { background: #f1f5f9; color: #64748b; }
    }

    .actions-header { text-align: right; }
    .actions-cell { text-align: right; white-space: nowrap; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; text-align: center; padding: 50px 20px; color: #64748b;
      mat-icon { font-size: 52px; width: 52px; height: 52px; color: #cbd5e1; margin-bottom: 12px; }
      h3 { margin: 0 0 6px; font-size: 1.1rem; color: #1e293b; }
      p { margin: 0; font-size: 0.88rem; max-width: 450px; }
    }
  `]
})
export class HolidaysComponent implements OnInit {
  private api = API_BASE;
  holidays: HolidayDto[] = [];
  filteredHolidays: HolidayDto[] = [];
  loading = false;
  saving = false;
  showForm = false;
  isEditing = false;
  editingId: string | null = null;

  selectedYear = 2026;
  selectedMonth = 0;
  selectedType = '';
  searchKeyword = '';

  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  formData: any = {
    title: '',
    startDate: '',
    endDate: '',
    holidayType: 'Festival',
    description: '',
    isActive: true
  };

  constructor(
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadHolidays();
  }

  loadHolidays(): void {
    this.loading = true;
    const params: any = { activeOnly: false };
    if (this.selectedYear > 0) params.year = this.selectedYear;
    if (this.selectedMonth > 0) params.month = this.selectedMonth;

    this.http.get<HolidayDto[]>(`${this.api}/holidays`, { params }).subscribe({
      next: (res) => {
        this.holidays = res || [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.holidays = [];
        this.filteredHolidays = [];
      }
    });
  }

  applyFilter(): void {
    let list = [...this.holidays];

    if (this.selectedType) {
      list = list.filter((h) => h.holidayType.toLowerCase() === this.selectedType.toLowerCase());
    }

    if (this.searchKeyword.trim()) {
      const q = this.searchKeyword.toLowerCase().trim();
      list = list.filter(
        (h) => h.title.toLowerCase().includes(q) || (h.description && h.description.toLowerCase().includes(q))
      );
    }

    this.filteredHolidays = list;
  }

  countByType(type: string): number {
    return this.holidays.filter((h) => h.holidayType.toLowerCase() === type.toLowerCase()).length;
  }

  openAddForm(): void {
    const todayStr = new Date().toISOString().split('T')[0];
    this.isEditing = false;
    this.editingId = null;
    this.formData = {
      title: '',
      startDate: todayStr,
      endDate: todayStr,
      holidayType: 'Festival',
      description: '',
      isActive: true
    };
    this.showForm = true;
  }

  onStartDateChange(): void {
    if (!this.formData.endDate || this.formData.endDate < this.formData.startDate) {
      this.formData.endDate = this.formData.startDate;
    }
  }

  editHoliday(item: HolidayDto): void {
    this.isEditing = true;
    this.editingId = item.id;
    this.formData = {
      title: item.title,
      startDate: item.startDate.split('T')[0],
      endDate: item.endDate.split('T')[0],
      holidayType: item.holidayType,
      description: item.description || '',
      isActive: item.isActive
    };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.isEditing = false;
    this.editingId = null;
  }

  saveHoliday(): void {
    if (!this.formData.title || !this.formData.startDate || !this.formData.endDate) return;

    this.saving = true;

    if (this.isEditing && this.editingId) {
      this.http.put(`${this.api}/holidays/${this.editingId}`, this.formData).subscribe({
        next: () => {
          this.saving = false;
          this.closeForm();
          this.loadHolidays();
          this.confirmDialog.alert('Holiday Updated', 'Holiday record updated successfully.', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update holiday.', 'danger');
        }
      });
    } else {
      this.http.post(`${this.api}/holidays`, this.formData).subscribe({
        next: () => {
          this.saving = false;
          this.closeForm();
          this.loadHolidays();
          this.confirmDialog.alert('Holiday Added', 'New holiday added to the academic calendar.', 'success');
        },
        error: (err) => {
          this.saving = false;
          this.confirmDialog.alert('Error', err?.error?.message || 'Failed to add holiday.', 'danger');
        }
      });
    }
  }

  deleteHoliday(item: HolidayDto): void {
    this.confirmDialog
      .danger(
        'Delete Holiday',
        `Are you sure you want to delete "${item.title}"? This will affect monthly faculty attendance and holiday counters.`,
        'Delete'
      )
      .subscribe((confirmed) => {
        if (confirmed) {
          this.http.delete(`${this.api}/holidays/${item.id}`).subscribe({
            next: () => {
              this.loadHolidays();
              this.confirmDialog.alert('Deleted', 'Holiday removed from calendar.', 'success');
            },
            error: () => {
              this.confirmDialog.alert('Error', 'Unable to delete holiday.', 'danger');
            }
          });
        }
      });
  }

  formatDayNum(dateStr: string): string {
    const d = new Date(dateStr);
    return String(d.getDate()).padStart(2, '0');
  }

  formatMonthYear(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  formatDayName(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }

  formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  calculateDuration(startStr: string, endStr: string): string {
    const s = new Date(startStr.split('T')[0]);
    const e = new Date(endStr.split('T')[0]);
    const diffTime = Math.abs(e.getTime() - s.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 Day' : `${diffDays} Days`;
  }
}
