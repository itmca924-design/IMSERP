import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { API_BASE } from '../teachers/teacher.models';

interface ReportRow {
  personId: string;
  personName: string;
  code: string;
  groupName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  holidayDays: number;
  totalWorkingDays: number;
  attendancePercentage: number;
}

interface AttendanceReport {
  reportType: string;
  month: number;
  year: number;
  totalPeople: number;
  totalPresentDays: number;
  totalAbsentDays: number;
  totalLateDays: number;
  totalHalfDays: number;
  totalHolidayDays: number;
  rows: ReportRow[];
}

@Component({
  selector: 'app-attendance-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatProgressBarModule, MatSelectModule, MatTooltipModule],
  template: `
<div class="report-page">
  <div class="page-header no-print">
    <div><h1><mat-icon>summarize</mat-icon> Attendance Reports</h1><p>Monthly attendance summary for students and faculty.</p></div>
    <button mat-raised-button color="primary" (click)="printReport()"><mat-icon>print</mat-icon> Print Report</button>
  </div>

  <mat-card class="filter-card no-print">
    <div class="report-filters">
      <mat-form-field appearance="outline"><mat-label>Month</mat-label><mat-select [(ngModel)]="selectedMonth" (selectionChange)="loadReport()"><mat-option *ngFor="let month of months; let i = index" [value]="i + 1">{{ month }}</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Year</mat-label><mat-select [(ngModel)]="selectedYear" (selectionChange)="loadReport()"><mat-option *ngFor="let year of years" [value]="year">{{ year }}</mat-option></mat-select></mat-form-field>
      <mat-form-field appearance="outline" *ngIf="reportType === 'student'" class="batch-filter-field"><mat-label>Batch</mat-label><mat-select panelClass="report-batch-panel" [(ngModel)]="selectedBatchId" (selectionChange)="loadReport()"><mat-option value="">All Batches</mat-option><mat-option *ngFor="let batch of batches" [value]="batch.id">{{ batch.name }}</mat-option></mat-select></mat-form-field>
    </div>
    <div class="report-tabs"><button [class.active]="reportType === 'student'" (click)="changeReportType('student')"><mat-icon>people</mat-icon> Student Report</button><button [class.active]="reportType === 'teacher'" (click)="changeReportType('teacher')"><mat-icon>badge</mat-icon> Teacher Report</button></div>
  </mat-card>

  <div class="print-heading">
    <div>
      <h2>{{ reportType === 'student' ? 'Student' : 'Teacher' }} Attendance Report</h2>
      <span *ngIf="reportType === 'student'" class="print-batch-sub">Batch: {{ getSelectedBatchName() }}</span>
    </div>
    <div class="print-period-badge">{{ months[selectedMonth - 1] }} {{ selectedYear }}</div>
  </div>
  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

  <div class="kpi-grid" *ngIf="report">
    <div class="kpi people"><mat-icon>{{ reportType === 'student' ? 'people' : 'badge' }}</mat-icon><strong>{{ report.totalPeople }}</strong><small>Total {{ reportType === 'student' ? 'Students' : 'Teachers' }}</small></div>
    <div class="kpi present"><mat-icon>check_circle</mat-icon><strong>{{ report.totalPresentDays }}</strong><small>Present Marks</small></div>
    <div class="kpi absent"><mat-icon>cancel</mat-icon><strong>{{ report.totalAbsentDays }}</strong><small>Absent Marks</small></div>
    <div class="kpi late"><mat-icon>schedule</mat-icon><strong>{{ report.totalLateDays }}</strong><small>Late Marks</small></div>
    <div class="kpi half"><mat-icon>hourglass_bottom</mat-icon><strong>{{ report.totalHalfDays }}</strong><small>Half Days</small></div>
    <div class="kpi holiday"><mat-icon>beach_access</mat-icon><strong>{{ report.totalHolidayDays }}</strong><small>Holiday Days / Person</small></div>
  </div>

  <mat-card class="table-card" *ngIf="report">
    <div class="table-title"><strong>Monthly Person-wise Register</strong><span>{{ report.rows.length }} rows</span></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>{{ reportType === 'student' ? 'Student' : 'Teacher' }}</th><th>{{ reportType === 'student' ? 'Batch' : 'Code' }}</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>Holiday / Off</th><th>Working Days</th><th>Compliance</th></tr></thead><tbody><tr *ngFor="let row of report.rows; let index = index"><td>{{ index + 1 }}</td><td><strong>{{ row.personName }}</strong><small>{{ reportType === 'student' ? row.code : row.groupName }}</small></td><td>{{ reportType === 'student' ? row.groupName : row.code }}</td><td class="present-text">{{ row.presentDays }}</td><td class="absent-text">{{ row.absentDays }}</td><td class="late-text">{{ row.lateDays }}</td><td class="half-text">{{ row.halfDays }}</td><td class="holiday-text">{{ row.holidayDays }}</td><td>{{ row.totalWorkingDays }}</td><td><span class="percentage" [class.good]="row.attendancePercentage >= 75" [class.warning]="row.attendancePercentage >= 50 && row.attendancePercentage < 75" [class.low]="row.attendancePercentage < 50">{{ row.attendancePercentage }}%</span></td></tr><tr *ngIf="report.rows.length === 0"><td colspan="10" class="empty">No attendance data found for this period.</td></tr></tbody></table></div>
  </mat-card>
</div>
  `,
  styles: [`
    .report-page{display:flex;flex-direction:column;gap:18px}.page-header{display:flex;justify-content:space-between;align-items:center}.page-header h1{display:flex;align-items:center;gap:8px;margin:0;color:#1976d2;font-size:1.45rem}.page-header h1 mat-icon{font-size:27px;width:27px;height:27px}.page-header p{margin:4px 0 0;color:#64748b;font-size:.88rem}.filter-card{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:10px}.filter-card mat-form-field{width:160px}.report-tabs{display:flex;gap:5px;margin-right:auto}.report-tabs button{display:flex;align-items:center;gap:5px;border:1px solid #dbeafe;background:#f8fafc;color:#475569;border-radius:7px;padding:9px 12px;cursor:pointer;font:inherit;font-size:.78rem}.report-tabs button mat-icon{font-size:18px;width:18px;height:18px}.report-tabs button.active{background:#e0f2fe;color:#0369a1;border-color:#38bdf8;font-weight:700}.print-heading{display:flex;justify-content:space-between;align-items:center}.print-heading h2{margin:0;color:#1e293b;font-size:1.1rem}.print-heading span{color:#64748b;font-size:.85rem}.print-batch-sub{display:none}.print-period-badge{color:#64748b;font-size:.85rem;font-weight:600}.kpi-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}.kpi{min-height:82px;border:1px solid #dbeafe;border-radius:10px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}.kpi mat-icon{font-size:20px;width:20px;height:20px}.kpi strong{font-size:1.2rem}.kpi small{font-size:.68rem}.kpi.people{background:#eff6ff;color:#1d4ed8}.kpi.present{background:#f0fdf4;color:#15803d}.kpi.absent{background:#fef2f2;color:#b91c1c}.kpi.late{background:#fff7ed;color:#c2410c}.kpi.half{background:#faf5ff;color:#7e22ce}.kpi.holiday{background:#eff6ff;color:#2563eb}.table-card{padding:0;border-radius:10px;overflow:hidden}.table-title{display:flex;justify-content:space-between;padding:15px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.table-title span{color:#64748b;font-size:.78rem}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:900px;font-size:.82rem}th,td{padding:12px 14px;border-bottom:1px solid #f1f5f9;text-align:left;white-space:nowrap}th{color:#64748b;background:#fff;font-size:.72rem;text-transform:uppercase}td small{display:block;color:#94a3b8;margin-top:3px}.present-text{color:#15803d;font-weight:700}.absent-text{color:#b91c1c;font-weight:700}.late-text{color:#c2410c;font-weight:700}.half-text{color:#7e22ce;font-weight:700}.holiday-text{color:#2563eb;font-weight:700}.percentage{padding:4px 8px;border-radius:12px;font-weight:700;font-size:.75rem}.percentage.good{background:#dcfce7;color:#15803d}.percentage.warning{background:#fef3c7;color:#b45309}.percentage.low{background:#fee2e2;color:#b91c1c}.empty{text-align:center;padding:28px;color:#64748b}@media(max-width:900px){.filter-card{flex-wrap:wrap}.report-tabs{width:100%;margin-right:0}.kpi-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.page-header,.print-heading{align-items:flex-start;gap:10px;flex-direction:column}.filter-card mat-form-field{flex:1;min-width:130px}.kpi-grid{grid-template-columns:repeat(2,1fr)}}
    @media print {
      .no-print { display: none !important; }
      .report-page { gap: 12px !important; margin: 0 !important; padding: 0 !important; }
      .print-heading { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; padding-bottom: 8px !important; border-bottom: 2px solid #0f172a !important; margin-bottom: 12px !important; }
      .print-heading h2 { margin: 0 !important; color: #0f172a !important; font-size: 1.35rem !important; font-weight: 800 !important; }
      .print-batch-sub { display: block !important; font-size: 0.88rem !important; color: #475569 !important; font-weight: 600 !important; margin-top: 3px !important; }
      .print-period-badge { font-size: 0.95rem !important; color: #0f172a !important; font-weight: 700 !important; border: 1px solid #cbd5e1 !important; padding: 4px 10px !important; border-radius: 6px !important; background: #f8fafc !important; }
      .kpi-grid { grid-template-columns: repeat(6, 1fr) !important; gap: 8px !important; margin-bottom: 12px !important; }
      .kpi { min-height: auto !important; padding: 8px 4px !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important; box-shadow: none !important; }
      .kpi mat-icon { display: none !important; }
      .kpi strong { font-size: 1.15rem !important; }
      .kpi small { font-size: 0.68rem !important; }
      .table-card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; background: #ffffff !important; }
      .table-title { background: #f8fafc !important; padding: 8px 12px !important; border-bottom: 1px solid #cbd5e1 !important; }
      .table-wrap { overflow: visible !important; }
      table { width: 100% !important; min-width: 0 !important; font-size: 0.76rem !important; }
      th, td { padding: 6px 8px !important; border: 1px solid #e2e8f0 !important; white-space: normal !important; text-align: left !important; }
      th { background: #f8fafc !important; font-weight: 700 !important; }
      .percentage { padding: 2px 6px !important; }
    }
    .report-filters { display:flex; align-items:center; gap:12px; margin-left:0; margin-right:auto; order:1; }
    .filter-card .report-tabs { order:2; margin-left:auto; margin-right:0; align-self:flex-start; margin-top:0; }
    .report-filters mat-form-field { width:150px; }
    .report-filters .batch-filter-field { width:220px; }
    .batch-filter-field .mat-mdc-select-value-text { display:block; max-width:175px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    @media (min-width:901px) {
      .filter-card { display:grid; grid-template-columns:repeat(5, minmax(0, 1fr)); gap:10px; align-items:center; }
      .filter-card .report-tabs, .filter-card .report-filters { display:contents; }
      .filter-card .report-tabs button, .filter-card .report-filters mat-form-field { width:100%; min-width:0; margin:0; }
      .filter-card .report-tabs button { justify-content:center; align-self:center; }
    }
    ::ng-deep .report-batch-panel { width:380px !important; min-width:380px !important; max-width:calc(100vw - 32px) !important; margin-right:14px !important; transform:translateX(-24px) !important; }
    ::ng-deep .report-batch-panel .mat-mdc-option { min-height:44px; height:auto; padding:8px 14px; white-space:normal; line-height:1.25; }
    @media (max-width:900px) { .report-filters { width:100%; margin-left:0; margin-right:0; } }
    @media (max-width:600px) { .report-filters { flex-wrap:wrap; } .report-filters mat-form-field { flex:1; min-width:130px; } }
  `]
})
export class AttendanceReportsComponent implements OnInit {
  private api = API_BASE;
  reportType: 'student' | 'teacher' = 'student';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedBatchId = '';
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  batches: Array<{ id: string; name: string }> = [];
  report: AttendanceReport | null = null;
  loading = false;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<Array<{ id: string; name: string }>>(`${this.api}/batches`).subscribe({ next: batches => this.batches = batches || [] });
    this.loadReport();
  }

  changeReportType(type: 'student' | 'teacher'): void {
    this.reportType = type;
    if (type === 'teacher') this.selectedBatchId = '';
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    const endpoint = this.reportType === 'student' ? `${this.api}/students/attendance/report` : `${this.api}/teachers/attendance/report`;
    const params: Record<string, string | number> = { month: this.selectedMonth, year: this.selectedYear };
    if (this.reportType === 'student' && this.selectedBatchId) params['batchId'] = this.selectedBatchId;
    this.http.get<AttendanceReport>(endpoint, { params }).subscribe({ next: report => { this.report = report; this.loading = false; }, error: () => { this.report = null; this.loading = false; } });
  }

  getSelectedBatchName(): string {
    if (!this.selectedBatchId) return 'All Batches';
    const found = this.batches.find(b => b.id === this.selectedBatchId);
    return found ? found.name : 'All Batches';
  }

  printReport(): void { window.print(); }
}
