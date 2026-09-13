import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { API_BASE, AttendancePermissionsDto, AttendanceSettingsDto, HolidayDto } from '../teachers/teacher.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

interface StudentItem {
  id: string;
  rollNumber: string;
  studentName: string;
  batchName: string;
}

interface StudentAttendance {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  attendanceDate: string;
  status: string;
  remarks?: string;
  captureSource?: string;
}

interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
}

interface CalendarDay {
  dayNumber: number;
  dateStr: string;
  dayOfWeek: string;
  isToday: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  holiday?: HolidayDto;
  record?: StudentAttendance;
  status: string;
}

@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule,
    MatProgressBarModule, MatTooltipModule
  ],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title"><mat-icon>event_available</mat-icon> Student Attendance & Roster</h1>
      <p class="page-subtitle">Track daily student attendance, holidays, weekly offs, and monthly compliance.</p>
    </div>
    <a mat-stroked-button routerLink="/students"><mat-icon>people</mat-icon> Student Directory</a>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <mat-card class="selector-card mat-elevation-z1">
    <mat-icon color="primary" class="selector-icon">person_search</mat-icon>
    <mat-form-field appearance="outline" class="student-select">
      <mat-label>Select Student</mat-label>
      <mat-select [(ngModel)]="selectedStudentId" (selectionChange)="onStudentChanged()">
        <mat-option *ngFor="let student of students" [value]="student.id">
          {{ student.rollNumber }} - {{ student.studentName }} ({{ student.batchName }})
        </mat-option>
      </mat-select>
    </mat-form-field>
    <div class="student-context" *ngIf="selectedStudent">
      <strong>{{ selectedStudent.studentName }}</strong>
      <span>{{ selectedStudent.rollNumber }}</span>
      <span>{{ selectedStudent.batchName }}</span>
    </div>
  </mat-card>

  <div *ngIf="selectedStudent" class="attendance-wrapper">
    <mat-card class="period-card mat-elevation-z1">
      <div class="period-student"><mat-icon>account_circle</mat-icon><div><strong>{{ selectedStudent.studentName }}</strong><small>{{ selectedStudent.rollNumber }}</small></div></div>
      <div class="period-selectors">
        <mat-form-field appearance="outline"><mat-label>Month</mat-label><mat-select [(ngModel)]="attMonth" (selectionChange)="loadAttendance()"><mat-option *ngFor="let month of months; let i = index" [value]="i + 1">{{ month }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Year</mat-label><mat-select [(ngModel)]="attYear" (selectionChange)="loadAttendance()"><mat-option *ngFor="let year of years" [value]="year">{{ year }}</mat-option></mat-select></mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="mode-select"><mat-label>Student Attendance Mode</mat-label><mat-select [(ngModel)]="attendanceMode" (selectionChange)="saveAttendanceMode()" [disabled]="!attendancePermissions.canChangeMode"><mat-option value="Both">Manual + Biometric</mat-option><mat-option value="Manual">Manual Only</mat-option><mat-option value="Biometric">Biometric Only</mat-option></mat-select></mat-form-field>
      <button mat-raised-button color="primary" (click)="openNewRecord()" [disabled]="!attendancePermissions.canManualMark || attendanceMode === 'Biometric'" matTooltip="Manual marking is disabled by permission or mode"><mat-icon>add_task</mat-icon> Mark Attendance</button>
    </mat-card>

    <div class="summary-grid" *ngIf="summary">
      <div class="summary-card present"><mat-icon>check_circle</mat-icon><strong>{{ summary.presentDays }}</strong><small>Present Days</small></div>
      <div class="summary-card absent"><mat-icon>cancel</mat-icon><strong>{{ summary.absentDays }}</strong><small>Absent Days</small></div>
      <div class="summary-card late"><mat-icon>schedule</mat-icon><strong>{{ summary.lateDays }}</strong><small>Late Marks</small></div>
      <div class="summary-card half"><mat-icon>hourglass_bottom</mat-icon><strong>{{ summary.halfDays }}</strong><small>Half Days</small></div>
      <div class="summary-card holiday"><mat-icon>beach_access</mat-icon><strong>{{ summary.holidayDays }}</strong><small>Holidays / Off</small></div>
      <div class="summary-card compliance"><mat-icon>analytics</mat-icon><strong>{{ summary.attendancePercentage }}%</strong><small>Compliance</small></div>
      <div class="summary-card working"><mat-icon>calendar_today</mat-icon><strong>{{ summary.totalWorkingDays }}</strong><small>Working Days</small></div>
    </div>

    <mat-card class="form-card mat-elevation-z1" *ngIf="showForm">
      <div class="form-heading"><div><strong>{{ editingRecordId ? 'Edit Attendance Record' : 'Log Attendance Record' }}</strong><small>Enter date, status, and remarks.</small></div><button mat-icon-button (click)="showForm = false"><mat-icon>close</mat-icon></button></div>
      <div class="form-row">
        <mat-form-field appearance="outline"><mat-label>Attendance Date</mat-label><input matInput type="date" [(ngModel)]="formData.attendanceDate"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Attendance Status</mat-label><mat-select [(ngModel)]="formData.status"><mat-option value="Present">● Present</mat-option><mat-option value="Absent">● Absent</mat-option><mat-option value="Late">● Late</mat-option><mat-option value="HalfDay">● Half Day</mat-option><mat-option value="Holiday">● Holiday / Off</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline" class="remarks-field"><mat-label>Remarks / Notes</mat-label><input matInput [(ngModel)]="formData.remarks" placeholder="e.g. Medical leave"></mat-form-field>
      </div>
      <div class="form-actions"><button mat-button (click)="showForm = false">Cancel</button><button mat-raised-button color="primary" (click)="saveAttendance()" [disabled]="!formData.attendanceDate || !formData.status || saving"><mat-icon>save</mat-icon> Save Record</button></div>
    </mat-card>

    <mat-card class="calendar-card mat-elevation-z1">
      <div class="calendar-heading"><strong><mat-icon>calendar_view_month</mat-icon>{{ months[attMonth - 1] }} {{ attYear }} Monthly Day-by-Day Roster</strong><div class="legend"><span class="present-dot">● Present</span><span class="absent-dot">● Absent</span><span class="holiday-dot">★ Public Holiday</span><span class="sunday-dot">● Sunday</span><span class="saturday-dot">● Saturday</span></div></div>
      <div class="calendar-grid">
        <button *ngFor="let day of calendarDays" type="button" class="day-cell" [class.present]="day.status === 'Present'" [class.absent]="day.status === 'Absent'" [class.late]="day.status === 'Late'" [class.half]="day.status === 'HalfDay'" [class.holiday]="day.holiday && !day.record" [class.sunday]="day.isSunday && !day.record && !day.holiday" [class.saturday]="day.isSaturday && !day.record && !day.holiday" [class.today]="day.isToday" [class.locked]="isPublicHolidayOrSunday(day.dateStr) && !canEditPublicHolidayOrSunday" [matTooltip]="getDayTooltip(day)" (click)="openDay(day)"><span>{{ day.dayNumber }}</span><small>{{ day.dayOfWeek }}</small><b>{{ getShortTag(day) }}</b></button>
      </div>
    </mat-card>

    <mat-card class="records-card mat-elevation-z1" *ngIf="records.length">
      <div class="records-heading"><strong>Detailed Attendance Register</strong><span>{{ records.length }} Records</span></div>
      <div class="record-row" *ngFor="let record of records"><div><strong>{{ record.attendanceDate | date:'dd MMM yyyy' }}</strong><small>{{ record.attendanceDate | date:'EEEE' }}</small></div><span class="status" [ngClass]="record.status.toLowerCase()">{{ record.status === 'HalfDay' ? 'Half Day' : record.status }}</span><span class="source-tag">{{ record.captureSource || 'Manual' }}</span><span class="remarks">{{ record.remarks || '—' }}</span><div class="record-actions"><button mat-icon-button color="primary" (click)="editRecord(record)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Edit record"><mat-icon>edit</mat-icon></button><button mat-icon-button color="warn" (click)="deleteRecord(record.id)" [disabled]="!attendancePermissions.canCorrectAttendance || attendanceMode === 'Biometric' || (isPublicHolidayOrSunday(record.attendanceDate) && !canEditPublicHolidayOrSunday)" matTooltip="Delete record"><mat-icon>delete_outline</mat-icon></button></div></div>
    </mat-card>
  </div>
</div>
  `,
  styles: [`
    .page-container{display:flex;flex-direction:column;gap:20px}.page-header{display:flex;justify-content:space-between;align-items:center}.page-title{margin:0;color:#1976d2;font-size:1.45rem;display:flex;align-items:center;gap:8px}.page-subtitle{margin:4px 0 0;color:#64748b;font-size:.88rem}.selector-card,.period-card{display:flex;flex-direction:row !important;flex-wrap:nowrap !important;align-items:center;gap:16px;padding:10px 18px;border-radius:10px;min-height:78px;box-sizing:border-box}.selector-icon{font-size:28px;width:28px;height:28px;flex:0 0 28px}.student-select{flex:1 1 auto;min-width:280px;margin:0}.student-context{display:flex;flex:0 0 250px;flex-direction:column;gap:2px;color:#64748b;font-size:.78rem}.student-context strong{color:#1e293b;font-size:.9rem}.period-card{justify-content:space-between;min-height:82px;margin-bottom:8px}.period-student{display:flex;align-items:center;gap:10px;color:#2563eb;flex:1 1 auto;min-width:180px}.period-student mat-icon{font-size:28px;width:28px;height:28px}.period-student div{display:flex;flex-direction:column}.period-student small{color:#64748b}.period-selectors{display:flex;gap:10px;flex:0 0 auto}.period-selectors mat-form-field{width:155px;margin:0}.summary-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:18px;margin:4px 0 10px}.summary-card{min-height:80px;border:1px solid #dbeafe;border-radius:10px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:#f8fafc}.summary-card mat-icon{font-size:20px;width:20px;height:20px}.summary-card strong{font-size:1.2rem}.summary-card small{font-size:.68rem}.summary-card.present{color:#15803d;background:#f0fdf4}.summary-card.absent{color:#b91c1c;background:#fef2f2}.summary-card.late{color:#c2410c;background:#fff7ed}.summary-card.half{color:#7e22ce;background:#faf5ff}.summary-card.holiday{color:#1d4ed8;background:#eff6ff}.summary-card.compliance{color:#0369a1;background:#ecfeff}.summary-card.working{color:#334155;background:#f8fafc}.form-card{padding:14px 18px;border-radius:10px}.form-heading,.form-actions,.calendar-heading,.records-heading{display:flex;align-items:center;justify-content:space-between}.form-heading div{display:flex;flex-direction:column}.form-heading small{color:#64748b;margin-top:3px}.form-row{display:flex;gap:12px;margin-top:12px}.form-row mat-form-field{flex:1}.form-row .remarks-field{flex:1.5}.form-actions{justify-content:flex-end;gap:8px}.calendar-card,.records-card{padding:16px;border-radius:10px}.calendar-heading{margin-bottom:14px;gap:10px}.calendar-heading strong{display:flex;align-items:center;gap:7px;color:#1e293b}.calendar-heading mat-icon{color:#2563eb}.legend{display:flex;gap:10px;font-size:.7rem}.present-dot{color:#15803d}.absent-dot{color:#dc2626}.holiday-dot{color:#b45309}.sunday-dot{color:#e11d48}.saturday-dot{color:#4f46e5}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:9px}.day-cell{min-height:66px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;color:#334155}.day-cell span{font-weight:800}.day-cell small{color:#94a3b8;font-size:.66rem}.day-cell b{font-size:.66rem}.day-cell.present{background:#dcfce7;border-color:#86efac;color:#15803d}.day-cell.absent{background:#fee2e2;border-color:#fca5a5;color:#b91c1c}.day-cell.late{background:#ffedd5;border-color:#fdba74;color:#c2410c}.day-cell.half{background:#f3e8ff;border-color:#d8b4fe;color:#7e22ce}.day-cell.holiday{background:#fef3c7;border-color:#fbbf24;color:#b45309}.day-cell.sunday{background:#ffe4e6;color:#be123c}.day-cell.saturday{background:#e0e7ff;color:#4338ca}.day-cell.today{box-shadow:0 0 0 2px #2563eb inset}.records-heading{padding-bottom:10px;border-bottom:1px solid #e2e8f0}.records-heading span{color:#64748b;font-size:.78rem}.record-row{display:grid;grid-template-columns:190px 120px 1fr 42px 42px;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}.record-row>div{display:flex;flex-direction:column}.record-row small{color:#64748b;font-size:.72rem}.status{font-size:.75rem;font-weight:700}.status.present{color:#15803d}.status.absent{color:#b91c1c}.status.late{color:#c2410c}.status.halfday{color:#7e22ce}.status.holiday{color:#1d4ed8}.remarks{color:#64748b;font-size:.82rem}.empty-state{padding:24px;text-align:center;color:#64748b}@media(max-width:900px){.summary-grid{grid-template-columns:repeat(4,1fr);gap:14px}.period-card{flex-wrap:wrap !important}.legend{flex-wrap:wrap}.form-row{flex-wrap:wrap}}@media(max-width:600px){.page-header,.selector-card,.period-card{align-items:stretch;flex-direction:column !important;flex-wrap:nowrap !important}.student-select{min-width:0}.student-context,.period-student{flex-basis:auto}.summary-grid{grid-template-columns:repeat(2,1fr);gap:12px}.calendar-grid{gap:5px}.day-cell{min-height:54px}.record-row{grid-template-columns:1fr 90px 40px 40px}.remarks{display:none}}
    .calendar-card { margin-bottom: 12px; }
    .records-card { margin-top: 2px; }
    .record-row{grid-template-columns:190px 120px 100px minmax(100px,1fr) 104px}.record-actions{display:flex !important;flex-direction:row !important;align-items:center;justify-content:flex-end;gap:0;white-space:nowrap;width:104px;min-width:104px}.record-actions button{display:inline-flex;flex:0 0 48px;width:48px;height:48px}
  `]
})
export class StudentAttendanceComponent implements OnInit {
  private api = API_BASE;
  students: StudentItem[] = [];
  selectedStudentId = '';
  selectedStudent?: StudentItem;
  records: StudentAttendance[] = [];
  holidays: HolidayDto[] = [];
  calendarDays: CalendarDay[] = [];
  summary: AttendanceSummary | null = null;
  loading = false;
  saving = false;
  showForm = false;
  canEditPublicHolidayOrSunday = false;
  editingRecordId: string | null = null;
  attMonth = new Date().getMonth() + 1;
  attYear = new Date().getFullYear();
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  formData = { attendanceDate: new Date().toISOString().split('T')[0], status: 'Present', remarks: '' };
  attendanceMode: AttendanceSettingsDto['studentMode'] = 'Both';
  private attendanceSettings: AttendanceSettingsDto = { studentMode: 'Both', teacherMode: 'Both' };
  attendancePermissions: AttendancePermissionsDto = { canChangeMode: false, canManualMark: false, canBiometricCapture: false, canMapBiometric: false, canCorrectAttendance: false };

  constructor(private http: HttpClient, private route: ActivatedRoute, private confirmDialog: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadAttendanceSettings();
    this.http.get<AttendancePermissionsDto>(`${this.api}/attendance/permissions`).subscribe({ next: permissions => this.attendancePermissions = permissions });
    this.http.get<any[]>(`${this.api}/students`).subscribe({
      next: students => {
        this.students = students || [];
        const requestedId = this.route.snapshot.queryParamMap.get('studentId');
        this.selectedStudentId = requestedId && this.students.some(s => s.id === requestedId) ? requestedId : (this.students[0]?.id || '');
        this.onStudentChanged();
      }
    });
  }

  loadAttendanceSettings(): void {
    this.http.get<AttendanceSettingsDto>(`${this.api}/attendance/settings`).subscribe({
      next: settings => { this.attendanceSettings = settings; this.attendanceMode = settings.studentMode; },
      error: () => { this.attendanceMode = 'Both'; }
    });
  }

  saveAttendanceMode(): void {
    this.attendanceSettings.studentMode = this.attendanceMode;
    this.http.put<AttendanceSettingsDto>(`${this.api}/attendance/settings`, this.attendanceSettings).subscribe({
      next: settings => this.attendanceSettings = settings,
      error: err => { this.attendanceMode = this.attendanceSettings.studentMode; this.confirmDialog.alert('Error', err?.error?.message || 'Failed to update attendance mode.', 'danger'); }
    });
  }

  onStudentChanged(): void {
    this.selectedStudent = this.students.find(student => student.id === this.selectedStudentId);
    if (this.selectedStudent) {
      this.loadPublicHolidaySundayPermission();
      this.loadAttendance();
    }
  }

  loadPublicHolidaySundayPermission(): void {
    this.http.get<{ canEdit: boolean }>(`${this.api}/students/attendance/ph-sun-edit-permission`).subscribe({
      next: result => this.canEditPublicHolidayOrSunday = result.canEdit,
      error: () => this.canEditPublicHolidayOrSunday = false
    });
  }

  loadAttendance(): void {
    if (!this.selectedStudentId) return;
    this.loading = true;
    const params = { month: this.attMonth, year: this.attYear };
    this.http.get<StudentAttendance[]>(`${this.api}/students/${this.selectedStudentId}/attendance`, { params }).subscribe({ next: records => { this.records = records || []; this.loading = false; this.loadHolidaysAndCalendar(); }, error: () => { this.records = []; this.loading = false; this.loadHolidaysAndCalendar(); } });
    this.http.get<AttendanceSummary>(`${this.api}/students/${this.selectedStudentId}/attendance/summary`, { params }).subscribe({ next: summary => this.summary = summary, error: () => this.summary = null });
  }

  loadHolidaysAndCalendar(): void {
    this.http.get<HolidayDto[]>(`${this.api}/holidays`, { params: { month: this.attMonth, year: this.attYear, activeOnly: true } }).subscribe({ next: holidays => { this.holidays = holidays || []; this.buildCalendar(); }, error: () => { this.holidays = []; this.buildCalendar(); } });
  }

  buildCalendar(): void {
    const daysInMonth = new Date(this.attYear, this.attMonth, 0).getDate();
    const today = new Date().toISOString().split('T')[0];
    const week = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    this.calendarDays = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(this.attYear, this.attMonth - 1, index + 1);
      const dateStr = `${this.attYear}-${String(this.attMonth).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      const record = this.records.find(item => item.attendanceDate.split('T')[0] === dateStr);
      const holiday = this.holidays.find(item => dateStr >= item.startDate.split('T')[0] && dateStr <= item.endDate.split('T')[0]);
      return { dayNumber: index + 1, dateStr, dayOfWeek: week[date.getDay()], isToday: dateStr === today, isSunday: date.getDay() === 0, isSaturday: date.getDay() === 6, holiday, record, status: record?.status || (holiday || date.getDay() === 0 ? 'Holiday' : 'Unmarked') };
    });
  }

  getShortTag(day: CalendarDay): string { if (day.record) return day.status === 'HalfDay' ? 'HD' : day.status.substring(0, 1); if (day.holiday) return 'PH'; if (day.isSunday) return 'SUN'; if (day.isSaturday) return 'SAT'; return '—'; }
  getDayTooltip(day: CalendarDay): string { const details: string[] = []; if (day.holiday) details.push(`${day.holiday.title} (${day.holiday.holidayType})${day.holiday.description ? ` - ${day.holiday.description}` : ''}`); if (day.isSunday) details.push('Sunday Weekly Off'); if (day.isSaturday) details.push('Saturday'); if (day.record) details.push(`Status: ${day.status}${day.record.remarks ? ` | ${day.record.remarks}` : ''}`); return details.join(' | ') || `${day.dateStr} - Unmarked`; }

  openDay(day: CalendarDay): void {
    if (this.isPublicHolidayOrSunday(day.dateStr) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.formData = { attendanceDate: day.dateStr, status: day.record?.status || (day.holiday || day.isSunday ? 'Holiday' : 'Present'), remarks: day.record?.remarks || (day.holiday?.title || (day.isSunday ? 'Sunday Weekly Off' : '')) };
    this.editingRecordId = day.record?.id || null;
    this.showForm = true;
  }
  openNewRecord(): void { this.formData = { attendanceDate: new Date().toISOString().split('T')[0], status: 'Present', remarks: '' }; this.editingRecordId = null; this.showForm = true; }
  editRecord(record: StudentAttendance): void {
    const date = record.attendanceDate.split('T')[0];
    if (this.isPublicHolidayOrSunday(date) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.formData = { attendanceDate: date, status: record.status, remarks: record.remarks || '' };
    this.editingRecordId = record.id;
    this.showForm = true;
  }

  saveAttendance(): void {
    if (!this.selectedStudentId || !this.formData.attendanceDate) return;
    if (!this.attendancePermissions.canManualMark) {
      this.confirmDialog.alert('Permission Denied', 'You do not have permission to mark manual attendance.', 'warning');
      return;
    }
    if (this.attendanceMode === 'Biometric') {
      this.confirmDialog.alert('Biometric Mode', 'Manual student attendance is disabled in Biometric Only mode.', 'warning');
      return;
    }
    if (this.isPublicHolidayOrSunday(this.formData.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.saving = true;
    this.http.post(`${this.api}/students/${this.selectedStudentId}/attendance`, this.formData).subscribe({ next: () => { this.saving = false; this.showForm = false; this.loadAttendance(); this.confirmDialog.alert('Attendance Saved', 'Student attendance saved successfully.', 'success'); }, error: err => { this.saving = false; this.confirmDialog.alert('Error', err?.error?.message || 'Failed to save attendance.', 'danger'); } });
  }

  deleteRecord(id: string): void {
    const record = this.records.find(item => item.id === id);
    if (record && this.isPublicHolidayOrSunday(record.attendanceDate) && !this.canEditPublicHolidayOrSunday) {
      this.confirmDialog.alert('Editing Disabled', 'Sunday/Public Holiday attendance editing is disabled for this role.', 'warning');
      return;
    }
    this.confirmDialog.danger('Delete Attendance Record', 'Are you sure you want to delete this student attendance record?', 'Delete Record').subscribe(confirmed => { if (!confirmed) return; this.http.delete(`${this.api}/students/attendance/${id}`).subscribe({ next: () => { this.loadAttendance(); this.confirmDialog.alert('Deleted', 'Attendance record deleted.', 'success'); }, error: err => this.confirmDialog.alert('Error', err?.error?.message || 'Failed to delete attendance.', 'danger') }); });
  }

  isPublicHolidayOrSunday(dateValue: string): boolean {
    const dateOnly = dateValue.split('T')[0];
    if (new Date(`${dateOnly}T00:00:00`).getDay() === 0) return true;
    return this.holidays.some(holiday => dateOnly >= holiday.startDate.split('T')[0] && dateOnly <= holiday.endDate.split('T')[0]);
  }
}
