import { Component, Inject, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

export interface CoachingWeeklyMarksheetDialogData {
  testId: string;
  title: string;
  subject: string;
  batchName?: string;
  canEdit: boolean;
  divisionMode?: 'school' | 'coaching';
}

interface MarksheetRow {
  studentId: string;
  studentName: string;
  rollNumber: string;
  parentName: string;
  parentWhatsAppPhone: string;
  profilePhoto?: string;
  marksObtained: number;
  maxMarks: number;
  passingMarks: number;
  percentage: number;
  grade: string;
  rank: number;
  isAbsent: boolean;
  isPassed: boolean;
  remarks: string;
}

@Component({
  selector: 'app-coaching-weekly-marksheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="marksheet-dialog">
      <!-- Strict Light-Blue Gradient ERP Dialog Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>workspace_premium</mat-icon>
          </div>
          <div class="header-titles">
            <div class="title-row">
              <h2 class="dialog-title">{{ isSchoolMode ? 'School Exam Marksheet, Class Rank & Parent Dispatch' : 'Weekly Exam Marksheet, Rank Card & Parent Dispatch' }}</h2>
              @if (sheetData?.isMarksLocked) {
                <span class="locked-pill"><mat-icon>verified</mat-icon> Official Approved Result</span>
              }
            </div>
            <p class="dialog-subtitle">
              Exam: <strong>{{ sheetData?.title || data.title }}</strong>
              &bull; Subject: <strong>{{ sheetData?.subject || data.subject }}</strong>
              @if (sheetData?.batchName || data.batchName) {
                &bull; {{ isSchoolMode ? 'Class' : 'Batch' }}: <strong>{{ sheetData?.batchName || data.batchName }}</strong>
              }
              &bull; Max Marks: <strong>{{ sheetData?.maxMarks || 0 }}</strong>
            </p>
          </div>
        </div>
        <button type="button" mat-icon-button class="close-btn" [disabled]="loading" (click)="close()" matTooltip="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Single Prominent Overlay Loader -->
      @if (loading) {
        <div class="overlay-loader">
          <div class="overlay-card">
            <mat-spinner diameter="42"></mat-spinner>
            <div class="overlay-text">{{ loadingMessage || 'Loading weekly exam marksheet...' }}</div>
          </div>
        </div>
      }

      <mat-dialog-content class="dialog-body">
        @if (rows.length === 0 && !loading) {
          <div class="empty-state">
            <mat-icon>assignment_late</mat-icon>
            <h3>Marks Not Entered Yet</h3>
            <p>Please enter and save marks for this coaching test first using <strong>Enter Marks</strong> from the Tests action menu. Once marks are entered, Ranks, A4 Marksheets, AI Remarks, and Parent WhatsApp alerts will be ready here.</p>
          </div>
        } @else if (rows.length > 0) {
          <!-- KPI Strip -->
          <div class="kpi-strip">
            <div class="kpi-box">
              <span class="k-lbl">Appeared / Total</span>
              <span class="k-val">{{ summary?.appearedCount || 0 }} / {{ summary?.totalStudents || 0 }}</span>
            </div>
            <div class="kpi-box green">
              <span class="k-lbl">Pass Rate</span>
              <span class="k-val">{{ summary?.passRate || 0 }}% ({{ summary?.passedCount || 0 }})</span>
            </div>
            <div class="kpi-box blue">
              <span class="k-lbl">Batch Average</span>
              <span class="k-val">{{ summary?.average || 0 }} / {{ sheetData?.maxMarks }}</span>
            </div>
            <div class="kpi-box gold">
              <span class="k-lbl">Batch Topper (#1)</span>
              <span class="k-val">{{ summary?.topperName }} ({{ summary?.topperScore }})</span>
            </div>
          </div>

          <!-- Action & Search Toolbar -->
          <div class="toolbar-bar">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
              <mat-label>Search student by name or roll...</mat-label>
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [formControl]="searchControl" />
            </mat-form-field>

            <div class="filter-pills">
              <button type="button" class="f-pill" [class.active]="statusFilter === 'ALL'" (click)="setFilter('ALL')">All ({{ rows.length }})</button>
              <button type="button" class="f-pill" [class.active]="statusFilter === 'PASS'" (click)="setFilter('PASS')">Passed</button>
              <button type="button" class="f-pill" [class.active]="statusFilter === 'FAIL'" (click)="setFilter('FAIL')">Needs Attention</button>
              <button type="button" class="f-pill" [class.active]="statusFilter === 'ABSENT'" (click)="setFilter('ABSENT')">Absent</button>
            </div>

            <div class="bulk-actions">
              @if (data.canEdit) {
                <button type="button" mat-stroked-button color="primary" (click)="generateAiRemarks()" [disabled]="loading" matTooltip="Use Gemini AI to write personalized parent-friendly remarks for every student">
                  <mat-icon>auto_awesome</mat-icon> AI Remarks
                </button>
              }
              <button type="button" mat-stroked-button (click)="printMeritList()" [disabled]="loading">
                <mat-icon>emoji_events</mat-icon> Print Merit List
              </button>
              <button type="button" mat-flat-button color="primary" (click)="printMarksheets(filteredRows)" [disabled]="loading || filteredRows.length === 0">
                <mat-icon>print</mat-icon> Print All A4 Marksheets ({{ filteredRows.length }})
              </button>
            </div>
          </div>

          <!-- Rank & Marksheet Table -->
          <div class="table-responsive">
            <table class="rank-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>{{ isSchoolMode ? 'Roll / Adm No' : 'Coaching Roll' }}</th>
                  <th>Student Name</th>
                  <th>Marks</th>
                  <th>% &amp; Grade</th>
                  <th>Performance Remark</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (r of filteredRows; track r.studentId) {
                  <tr>
                    <td>
                      @if (r.isAbsent) {
                        <span class="rank-badge absent">AB</span>
                      } @else if (r.rank === 1) {
                        <span class="rank-badge gold">#1</span>
                      } @else if (r.rank === 2) {
                        <span class="rank-badge silver">#2</span>
                      } @else if (r.rank === 3) {
                        <span class="rank-badge bronze">#3</span>
                      } @else {
                        <span class="rank-badge normal">#{{ r.rank }}</span>
                      }
                    </td>
                    <td><code>{{ r.rollNumber }}</code></td>
                    <td>
                      <div class="st-name">{{ r.studentName }}</div>
                      @if (r.parentWhatsAppPhone) {
                        <div class="st-sub">Parent: {{ r.parentWhatsAppPhone }}</div>
                      }
                    </td>
                    <td>
                      @if (r.isAbsent) {
                        <span class="absent-txt">Absent</span>
                      } @else {
                        <strong>{{ r.marksObtained }}</strong> / {{ r.maxMarks }}
                      }
                    </td>
                    <td>
                      <span class="grade-pill" [class.pass]="r.isPassed" [class.fail]="!r.isPassed && !r.isAbsent" [class.ab]="r.isAbsent">
                        {{ r.isAbsent ? 'AB' : (r.percentage + '% (' + r.grade + ')') }}
                      </span>
                    </td>
                    <td class="remark-col">{{ r.remarks }}</td>
                    <td class="text-center">
                      <div class="row-actions">
                        <button type="button" mat-icon-button color="primary" (click)="printMarksheets([r])" matTooltip="Print A4 Marksheet for {{ r.studentName }}">
                          <mat-icon>print</mat-icon>
                        </button>
                        <button type="button" mat-icon-button class="wa-btn" (click)="shareOnWhatsApp(r)" matTooltip="Send Result to Parent on WhatsApp">
                          <mat-icon>chat</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </mat-dialog-content>

      <div class="dialog-footer">
        <span class="footer-note">
          <mat-icon>verified_user</mat-icon> Dynamic Tenant Letterhead, Official Seal &amp; Digital Signature Ready
        </span>
        <button type="button" mat-stroked-button [disabled]="loading" (click)="close()">Close</button>
      </div>
    </div>
  `,
  styles: [`
    .marksheet-dialog {
      position: relative; display: flex; flex-direction: column; height: 100%; max-height: 92vh; background: #f8fafc;
    }
    .dialog-header {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border-bottom: 1px solid #bfdbfe; padding: 14px 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-icon-box {
      width: 42px; height: 42px; border-radius: 10px; background: #2563eb; color: #ffffff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }
    .title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .dialog-title { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1e3a8a; }
    .dialog-subtitle { margin: 2px 0 0; font-size: 0.8rem; color: #3b82f6; strong { color: #1e40af; } }
    .locked-pill {
      display: inline-flex; align-items: center; gap: 4px; background: #dcfce7; color: #15803d;
      font-size: 0.72rem; font-weight: 700; padding: 2px 10px; border-radius: 12px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .close-btn { color: #64748b; &:hover { color: #1e293b; } }

    .overlay-loader {
      position: absolute; inset: 0; z-index: 50; background: rgba(248, 250, 252, 0.85);
      backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center;
    }
    .overlay-card {
      background: #ffffff; border: 1px solid #bfdbfe; border-radius: 14px; padding: 24px 32px;
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      box-shadow: 0 12px 30px rgba(30, 58, 138, 0.16);
    }
    .overlay-text { font-size: 0.9rem; font-weight: 600; color: #1e3a8a; }

    .dialog-body {
      flex: 1; overflow-y: auto; padding: 18px 20px !important; margin: 0 !important; max-height: none !important;
      display: flex; flex-direction: column; gap: 14px;
    }

    .empty-state {
      text-align: center; padding: 48px 20px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #3b82f6; }
      h3 { margin: 8px 0 6px; color: #1e3a8a; }
      p { max-width: 520px; margin: 0 auto; font-size: 0.86rem; line-height: 1.5; }
    }

    .kpi-strip {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px;
    }
    .kpi-box {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 2px;
      .k-lbl { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: #64748b; }
      .k-val { font-size: 1rem; font-weight: 800; color: #0f172a; }
      &.green { background: #f0fdf4; border-color: #bbf7d0; .k-val { color: #15803d; } }
      &.blue { background: #eff6ff; border-color: #bfdbfe; .k-val { color: #1d4ed8; } }
      &.gold { background: #fffbeb; border-color: #fde68a; .k-val { color: #b45309; } }
    }

    .toolbar-bar {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px;
    }
    .search-field { flex: 1 1 220px; }
    .filter-pills, .bulk-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
    .f-pill {
      padding: 5px 12px; border-radius: 16px; border: 1px solid #cbd5e1; background: #f8fafc;
      color: #475569; font-size: 0.76rem; font-weight: 600; cursor: pointer;
      &.active { background: #2563eb; border-color: #2563eb; color: #ffffff; }
    }

    .table-responsive {
      background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; overflow-x: auto; -webkit-overflow-scrolling: touch;
    }
    .rank-table {
      width: 100%; border-collapse: collapse; font-size: 0.84rem;
      th, td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; text-align: left; }
      th { background: #f8fafc; font-weight: 700; color: #475569; font-size: 0.76rem; text-transform: uppercase; white-space: nowrap; }
    }
    .rank-badge {
      display: inline-block; padding: 2px 9px; border-radius: 8px; font-weight: 800; font-size: 0.76rem;
      &.gold { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
      &.silver { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
      &.bronze { background: #ffedd5; color: #c2410c; border: 1px solid #fdba74; }
      &.normal { background: #eff6ff; color: #1d4ed8; }
      &.absent { background: #fee2e2; color: #b91c1c; }
    }
    .st-name { font-weight: 700; color: #0f172a; white-space: nowrap; }
    .st-sub { font-size: 0.72rem; color: #64748b; }
    .absent-txt { color: #dc2626; font-weight: 600; }
    .grade-pill {
      display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 0.76rem; font-weight: 700; white-space: nowrap;
      &.pass { background: #dcfce7; color: #15803d; }
      &.fail { background: #fee2e2; color: #b91c1c; }
      &.ab { background: #f1f5f9; color: #64748b; }
    }
    .remark-col { font-size: 0.78rem; color: #334155; min-width: 220px; max-width: 340px; line-height: 1.4; }
    .row-actions { display: inline-flex; gap: 4px; }
    .wa-btn { color: #16a34a !important; }
    .text-center { text-align: center !important; }

    .dialog-footer {
      padding: 10px 20px; background: #ffffff; border-top: 1px solid #e2e8f0;
      display: flex; align-items: center; justify-content: space-between;
    }
    .footer-note {
      display: inline-flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #64748b;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2563eb; }
    }
  `]
})
export class CoachingWeeklyMarksheetDialogComponent implements OnInit {
  private _loading = false;
  get loading(): boolean { return this._loading; }
  set loading(val: boolean) {
    this._loading = val;
    if (this.dialogRef) this.dialogRef.disableClose = val;
  }
  loadingMessage = '';

  sheetData: any = null;
  summary: any = null;
  rows: MarksheetRow[] = [];
  filteredRows: MarksheetRow[] = [];
  statusFilter: 'ALL' | 'PASS' | 'FAIL' | 'ABSENT' = 'ALL';
  searchControl = new FormControl('');

  constructor(
    public dialogRef: MatDialogRef<CoachingWeeklyMarksheetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CoachingWeeklyMarksheetDialogData,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe(() => this.applyFilters());
    this.loadMarksheet();
  }

  get isSchoolMode(): boolean {
    return this.data.divisionMode === 'school' || !!this.sheetData?.isSchoolTest;
  }

  loadMarksheet(): void {
    this.loading = true;
    this.loadingMessage = 'Loading weekly marksheet & batch rankings...';
    this.http.get<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/weekly-marksheet`).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.sheetData = res;
        this.summary = res?.summary || null;
        this.rows = res?.rows || [];
        this.applyFilters();
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Could not load weekly marksheet.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  setFilter(f: 'ALL' | 'PASS' | 'FAIL' | 'ABSENT'): void {
    this.statusFilter = f;
    this.applyFilters();
  }

  applyFilters(): void {
    const q = (this.searchControl.value || '').trim().toLowerCase();
    let list = [...this.rows];
    if (this.statusFilter === 'PASS') list = list.filter(r => r.isPassed);
    else if (this.statusFilter === 'FAIL') list = list.filter(r => !r.isPassed && !r.isAbsent);
    else if (this.statusFilter === 'ABSENT') list = list.filter(r => r.isAbsent);

    if (q) {
      list = list.filter(r =>
        (r.studentName || '').toLowerCase().includes(q) ||
        (r.rollNumber || '').toLowerCase().includes(q)
      );
    }
    this.filteredRows = list;
    this.cdr.markForCheck();
  }

  generateAiRemarks(): void {
    this.loading = true;
    this.loadingMessage = 'Gemini AI is writing personalized parent-friendly performance remarks...';
    this.cdr.markForCheck();

    this.http.post<any>(`${environment.apiUrl}/coaching-ai-exam/tests/${this.data.testId}/ai-remarks`, {}).subscribe({
      next: res => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('AI Remarks Updated', res?.message || 'AI remarks generated successfully.', 'success');
        this.loadMarksheet();
      },
      error: err => {
        this.loading = false;
        this.loadingMessage = '';
        this.confirmDialog.alert('AI Remarks Notice', err?.error?.message || 'Could not generate AI remarks.', 'warning');
        this.cdr.markForCheck();
      }
    });
  }

  shareOnWhatsApp(r: MarksheetRow): void {
    const inst = this.authService.getInstituteName() || (this.isSchoolMode ? 'School Examination Board' : 'Coaching Institute');
    const testTitle = this.sheetData?.title || this.data.title;
    const subject = this.sheetData?.subject || this.data.subject;
    const batch = this.sheetData?.batchName || this.data.batchName || '';
    const groupLbl = this.isSchoolMode ? 'Class' : 'Batch';
    const rankLbl = this.isSchoolMode ? 'Class Rank' : 'Batch Rank';
    const avgLbl = this.isSchoolMode ? 'Class Avg' : 'Batch Avg';
    const statusLine = r.isAbsent
      ? 'Status: *ABSENT*'
      : `Marks: *${r.marksObtained} / ${r.maxMarks}* (${r.percentage}% • Grade *${r.grade}*)\n${rankLbl}: *#${r.rank}* (${avgLbl}: ${this.summary?.average || 0}/${r.maxMarks})`;

    const msg =
      `*${inst} — ${this.isSchoolMode ? 'Exam Progress Card' : 'Weekly Exam Progress Card'}*\n` +
      `Student: *${r.studentName}* (${r.rollNumber})\n` +
      (batch ? `${groupLbl}: ${batch}\n` : '') +
      `Exam: *${testTitle}* (${subject})\n` +
      `${statusLine}\n` +
      `Faculty Remark: _${r.remarks}_`;

    const rawPhone = (r.parentWhatsAppPhone || '').replace(/\D/g, '');
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener');
  }

  printMeritList(): void {
    const win = window.open('', '_blank', 'width=920,height=1050');
    if (!win) return;

    const inst = this.authService.getInstituteName() || 'Coaching Institute';
    const logo = this.authService.getInstituteLogoUrl() || '';
    const logoHtml = logo ? `<img src="${logo}" style="height:48px;object-fit:contain;" />` : '';

    const rowsHtml = this.rows.map(r => `
      <tr>
        <td style="text-align:center;font-weight:700;">${r.isAbsent ? 'AB' : '#' + r.rank}</td>
        <td style="text-align:center;">${this.esc(r.rollNumber)}</td>
        <td><strong>${this.esc(r.studentName)}</strong></td>
        <td style="text-align:center;font-weight:700;">${r.isAbsent ? 'Absent' : `${r.marksObtained} / ${r.maxMarks}`}</td>
        <td style="text-align:center;">${r.isAbsent ? '—' : `${r.percentage}%`}</td>
        <td style="text-align:center;font-weight:700;">${r.grade}</td>
        <td style="font-size:11.5px;">${this.esc(r.remarks)}</td>
      </tr>`).join('');

    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8" /><title>Merit List - ${this.esc(this.sheetData?.title || '')}</title>
      <style>@page{size:A4;margin:12mm;}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;}td,th{border:1px solid #cbd5e1;padding:6px 8px;}</style></head>
      <body>
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;text-align:center;">
          ${logoHtml}
          <div>
            <div style="font-size:19px;font-weight:800;text-transform:uppercase;">${this.esc(inst)}</div>
            <div style="font-size:13px;font-weight:700;color:#1e3a8a;">WEEKLY EXAM MERIT LIST &amp; RESULT SHEET</div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:12px;background:#f8fafc;border:1px solid #cbd5e1;padding:7px 10px;margin-bottom:10px;">
          <span><strong>Exam:</strong> ${this.esc(this.sheetData?.title)}</span>
          <span><strong>Subject:</strong> ${this.esc(this.sheetData?.subject)}</span>
          <span><strong>Batch:</strong> ${this.esc(this.sheetData?.batchName)}</span>
          <span><strong>Pass Rate:</strong> ${this.summary?.passRate}%</span>
          <span><strong>Batch Avg:</strong> ${this.summary?.average}/${this.sheetData?.maxMarks}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#eff6ff;">
            <th>Rank</th><th>Roll No</th><th style="text-align:left;">Student Name</th><th>Marks</th><th>%</th><th>Grade</th><th style="text-align:left;">Remark</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload=function(){window.print();};</script>
      </body></html>`);
    win.document.close();
  }

  printMarksheets(targets: MarksheetRow[]): void {
    const win = window.open('', '_blank', 'width=920,height=1050');
    if (!win) return;

    const inst = this.authService.getInstituteName() || 'Coaching Institute';
    const logo = this.authService.getInstituteLogoUrl() || '';
    const seal = this.authService.getOfficialSealUrl() || '';
    const sig = this.authService.getDigitalSignatureUrl() || '';
    const user: any = this.authService.currentUser();
    const selBranchId = this.authService.selectedBranchId();
    const activeBranch = (user?.branches || []).find((b: any) => b.id === selBranchId) || (user?.branches || []).find((b: any) => b.id === user?.branchId);
    const addr = activeBranch?.address || user?.instituteAddress || '';
    const signatory = user?.fullName || 'Authorized Signatory';

    const logoHtml = logo ? `<img src="${logo}" style="height:50px;object-fit:contain;" />` : '';
    const sealHtml = seal ? `<img src="${seal}" style="height:52px;object-fit:contain;opacity:0.85;" />` : '';
    const sigHtml = sig ? `<img src="${sig}" style="height:36px;object-fit:contain;" />` : '';

    const cardsHtml = targets.map((r, idx) => `
      <div style="border:2px solid #1e3a8a;border-radius:10px;padding:18px 22px;margin-bottom:20px;page-break-inside:avoid;${idx > 0 && idx % 2 === 0 ? 'page-break-before:always;' : ''}">
        <div style="display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2px solid #1e3a8a;padding-bottom:8px;margin-bottom:10px;text-align:center;">
          ${logoHtml}
          <div>
            <div style="font-size:18px;font-weight:800;text-transform:uppercase;color:#1e3a8a;">${this.esc(inst)}</div>
            ${addr ? `<div style="font-size:11px;color:#475569;">${this.esc(addr)}</div>` : ''}
            <div style="font-size:12.5px;font-weight:700;color:#2563eb;margin-top:2px;">${this.isSchoolMode ? 'SCHOOL EXAM PROGRESS CARD' : 'COACHING WEEKLY EXAM PROGRESS CARD'}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;font-size:12.5px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:8px 12px;margin-bottom:10px;">
          <div><strong>Student Name:</strong> ${this.esc(r.studentName)}</div>
          <div><strong>${this.isSchoolMode ? 'Roll / Adm No' : 'Coaching Roll'}:</strong> ${this.esc(r.rollNumber)}</div>
          <div><strong>${this.isSchoolMode ? 'Class / Section' : 'Batch'}:</strong> ${this.esc(this.sheetData?.batchName)}</div>
          <div><strong>Exam:</strong> ${this.esc(this.sheetData?.title)}</div>
          <div><strong>Subject / Chapter:</strong> ${this.esc(this.sheetData?.subject)} — ${this.esc(this.sheetData?.chapterTitle)}</div>
          <div><strong>${this.isSchoolMode ? 'Class Rank' : 'Batch Rank'}:</strong> <strong style="color:#1d4ed8;">${r.isAbsent ? 'ABSENT' : '#' + r.rank + ' of ' + (this.summary?.appearedCount || 0)}</strong></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:10px;">
          <thead><tr style="background:#eff6ff;">
            <th style="border:1px solid #94a3b8;padding:6px;">Max Marks</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Passing Marks</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Marks Obtained</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Percentage</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Grade</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Batch Avg / Highest</th>
            <th style="border:1px solid #94a3b8;padding:6px;">Result</th>
          </tr></thead>
          <tbody><tr style="text-align:center;font-weight:700;">
            <td style="border:1px solid #cbd5e1;padding:7px;">${r.maxMarks}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;">${r.passingMarks}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;font-size:14px;color:#1e3a8a;">${r.isAbsent ? 'AB' : r.marksObtained}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;">${r.isAbsent ? '—' : r.percentage + '%'}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;">${r.grade}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;">${this.summary?.average} / ${this.summary?.highest}</td>
            <td style="border:1px solid #cbd5e1;padding:7px;color:${r.isPassed ? '#15803d' : '#dc2626'};">${r.isAbsent ? 'ABSENT' : (r.isPassed ? 'PASSED' : 'NEEDS IMPROVEMENT')}</td>
          </tr></tbody>
        </table>
        <div style="font-size:12px;background:#f0fdf4;border-left:3px solid #16a34a;padding:7px 10px;margin-bottom:14px;">
          <strong>Academic Mentor Remark:</strong> ${this.esc(r.remarks)}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:11.5px;">
          <div>Parent Signature: ____________________</div>
          <div>${sealHtml}</div>
          <div style="text-align:center;">
            ${sigHtml}
            <div style="border-top:1px solid #475569;padding-top:2px;font-weight:700;">${this.esc(signatory)}</div>
          </div>
        </div>
      </div>`).join('');

    win.document.write(`
      <!doctype html><html><head><meta charset="utf-8" /><title>Weekly Marksheets</title>
      <style>@page{size:A4;margin:10mm;}body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;}</style></head>
      <body>${cardsHtml}<script>window.onload=function(){window.print();};</script></body></html>`);
    win.document.close();
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  close(): void {
    if (this.loading) return;
    this.dialogRef.close();
  }
}
