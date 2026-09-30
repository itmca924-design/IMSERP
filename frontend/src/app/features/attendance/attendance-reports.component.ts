import { Component, OnInit, OnDestroy } from '@angular/core';
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
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { API_BASE } from '../teachers/teacher.models';
import { AuthService } from '../../core/services/auth.service';
import { SchoolService, SchoolClassDto, SchoolSectionDto } from '../../core/services/school.service';

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
  schoolClass?: string | null;
  coachingBatch?: string | null;
  schoolRoll?: string | null;
  coachingRoll?: string | null;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
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
  totalWorkingDaysInMonth?: number;
  rows: ReportRow[];
  isDualEnrolled?: boolean;
  defaultStream?: string | null;
  totalCount?: number;
}

interface DailyDayItem {
  day: number;
  dayOfWeek: string;
  isSunday: boolean;
  status: string;
  label: string;
  statusText?: string;
  remarks?: string;
  holidayTitle?: string;
  checkInTime?: string;
  captureSource?: string;
}

type SortColumn = 'personName' | 'code' | 'presentDays' | 'absentDays' | 'lateDays' | 'halfDays' | 'totalWorkingDays' | 'attendancePercentage' | '';
type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-attendance-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule
  ],
  templateUrl: './attendance-reports.component.html',
  styleUrls: ['./attendance-reports.component.css']
})
export class AttendanceReportsComponent implements OnInit, OnDestroy {
  private api = API_BASE;
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  reportType: 'student' | 'teacher' = 'student';
  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  selectedBatchId = '';
  searchQuery = '';
  months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  years = [2024, 2025, 2026, 2027];
  batches: Array<{ id: string; name: string }> = [];
  schoolClasses: SchoolClassDto[] = [];
  studentFilterMode: 'all' | 'school' | 'coaching' = 'all';
  selectedClassId = '';
  selectedSectionId = '';
  classSections: SchoolSectionDto[] = [];
  report: AttendanceReport | null = null;
  loading = false;
  studentStreamMode: 'all' | 'school' | 'coaching' = 'all';
  streamInitialized = false;

  sortColumn: SortColumn = '';
  sortDir: SortDir = 'asc';

  pageIndex = 0;
  pageSize = 25;
  totalCount = 0;

  expandedPersonIds = new Set<string>();
  collapsingPersonIds = new Set<string>();
  expandAll = false;
  dailyMatrixCache: { [personId: string]: DailyDayItem[] } = {};
  dailyCalendarCache: { [personId: string]: (DailyDayItem | null)[][] } = {};
  streakCache: { [personId: string]: { current: number; max: number; label: string } } = {};
  weeklyPatternCache: { [personId: string]: Array<{ name: string; present: number; total: number; pct: number }> } = {};
  loadingDaily = new Set<string>();
  holidays: any[] = [];

  skeletonRows = Array(8).fill(0);
  skeletonDays = Array(31).fill(0);
  weekDayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // === Circular Ring ===
  readonly circumference = +(2 * Math.PI * 21).toFixed(3); // r=21

  getDashOffset(pct: number): number {
    return this.circumference - (Math.min(100, Math.max(0, pct)) / 100) * this.circumference;
  }

  isToday(day: number): boolean {
    const now = new Date();
    return now.getFullYear() === this.selectedYear &&
           now.getMonth() + 1 === this.selectedMonth &&
           now.getDate() === day;
  }

  // === Calendar Grid (Cached to prevent change-detection loops) ===
  getDailyMatrixCalendar(row: ReportRow): (DailyDayItem | null)[][] {
    if (this.dailyCalendarCache[row.personId]) {
      return this.dailyCalendarCache[row.personId];
    }
    const days = this.getDailyMatrix(row);
    const firstDayOfWeek = new Date(this.selectedYear, this.selectedMonth - 1, 1).getDay();
    const weeks: (DailyDayItem | null)[][] = [];
    let week: (DailyDayItem | null)[] = Array(firstDayOfWeek).fill(null);
    for (const day of days) {
      week.push(day);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    this.dailyCalendarCache[row.personId] = weeks;
    return weeks;
  }

  trackByWeekIndex(index: number): number {
    return index;
  }

  trackByDayNum(_index: number, d: DailyDayItem | null): string {
    return d ? `${d.day}-${d.status}-${d.remarks || ''}-${d.holidayTitle || ''}` : 'empty';
  }



  getStatusBadgeName(status: string): string {
    switch (status) {
      case 'P': return 'Present';
      case 'A': return 'Absent';
      case 'L': return 'Leave';
      case 'LT': return 'Late';
      case 'HD': return 'Half Day';
      case 'H': return 'Holiday';
      case 'OFF': return 'Weekly Off';
      default: return 'Unmarked';
    }
  }

  // === Row Warning Class ===
  getAttendanceRowClass(pct: number): string {
    if (pct < 50) return 'row-danger';
    if (pct < 75) return 'row-warning';
    return '';
  }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private schoolService: SchoolService
  ) {}

  logoFailed = false;

  get logoUrl(): string | null { return this.authService.getInstituteLogoUrl(); }
  get instituteName(): string { return this.authService.currentUser()?.instituteName || 'Apex Coaching Academy'; }
  get isStudentOrParent(): boolean { return this.authService.isStudentOrParent(); }

  get isDualStudent(): boolean {
    if (!this.isStudentOrParent) return false;
    if (this.report?.isDualEnrolled) return true;
    const r = this.report?.rows?.[0];
    return !!(r && r.isSchoolStudent && r.isCoachingStudent);
  }

  get totalPages(): number { return Math.ceil(this.clientTotalCount / this.pageSize); }
  get pageStart(): number { return this.clientTotalCount === 0 ? 0 : this.pageIndex * this.pageSize + 1; }
  get pageEnd(): number { return Math.min((this.pageIndex + 1) * this.pageSize, this.clientTotalCount); }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.pageIndex + 1;
    const pages: number[] = [];
    for (let p = Math.max(1, current - 2); p <= Math.min(total, current + 2); p++) pages.push(p);
    return pages;
  }

  /** Client-side: search filter + sort applied on current page data */
  get filteredAndSortedRows(): ReportRow[] {
    if (!this.report?.rows) return [];
    let rows = this.report.rows;
    // Client-side search
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        (r.personName && r.personName.toLowerCase().includes(q)) ||
        (r.code && r.code.toLowerCase().includes(q)) ||
        (r.groupName && r.groupName.toLowerCase().includes(q))
      );
    }
    // Client-side sort
    if (this.sortColumn) {
      const col = this.sortColumn;
      const dir = this.sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = (a as any)[col] ?? '';
        const bv = (b as any)[col] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }
    return rows;
  }

  /** Paginated slice of filteredAndSortedRows */
  get sortedRows(): ReportRow[] {
    const all = this.filteredAndSortedRows;
    if (this.isStudentOrParent) return all;
    const start = this.pageIndex * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  get clientTotalCount(): number {
    return this.filteredAndSortedRows.length;
  }

  ngOnInit(): void {
    // Search is client-side — no API call needed on search change
    if (this.isStudentOrParent) { this.reportType = 'student'; }
    else { this.loadBatches(); this.loadSchoolClasses(); }
    this.loadHolidays();
    this.loadReport();
  }

  loadHolidays(): void {
    this.http.get<any[]>(`${this.api}/holidays?activeOnly=true`).subscribe({
      next: h => {
        this.holidays = h || [];
        this.resetDailyCaches();
      },
      error: () => { this.holidays = []; }
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  onSearchChange(_val: string): void { this.pageIndex = 0; } // client-side filter via sortedRows getter
  clearSearch(): void { this.searchQuery = ''; this.pageIndex = 0; }

  setSortColumn(col: SortColumn): void {
    if (this.sortColumn === col) { this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc'; }
    else { this.sortColumn = col; this.sortDir = 'asc'; }
  }

  getSortIcon(col: SortColumn): string {
    if (this.sortColumn !== col) return '⇅';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.pageIndex = page;
    // No API call needed — data already loaded, just slice changes
    this.expandedPersonIds.clear(); this.collapsingPersonIds.clear(); this.expandAll = false;
  }

  onPageSizeChange(): void { this.pageIndex = 0; this.loadReport(); }

  setStudentStream(stream: 'all' | 'school' | 'coaching'): void {
    if (this.studentStreamMode === stream) return;
    this.studentStreamMode = stream;
    this.resetDailyCaches();
    this.loadingDaily.clear();
    this.loadReport();
  }

  loadBatches(): void {
    this.http.get<Array<{ id: string; name: string }>>(`${this.api}/batches`).subscribe({
      next: b => this.batches = b || [], error: () => this.batches = []
    });
  }

  loadSchoolClasses(): void {
    this.schoolService.getClasses(true).subscribe({ next: c => this.schoolClasses = c || [], error: () => this.schoolClasses = [] });
  }

  onFilterModeChanged(): void {
    this.selectedClassId = ''; this.selectedSectionId = ''; this.classSections = [];
    this.selectedBatchId = ''; this.pageIndex = 0; this.loadReport();
  }

  onClassFilterChanged(): void {
    const found = this.schoolClasses.find(c => c.id === this.selectedClassId);
    this.classSections = found?.sections || []; this.selectedSectionId = ''; this.pageIndex = 0; this.loadReport();
  }

  changeReportType(type: 'student' | 'teacher'): void {
    if (this.isStudentOrParent) return;
    this.reportType = type;
    if (type === 'teacher') { this.selectedBatchId = ''; this.selectedClassId = ''; this.selectedSectionId = ''; }
    this.searchQuery = ''; this.pageIndex = 0; this.sortColumn = '';
    this.expandedPersonIds.clear(); this.collapsingPersonIds.clear(); this.expandAll = false;
    this.resetDailyCaches();
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    this.expandedPersonIds.clear(); this.collapsingPersonIds.clear(); this.expandAll = false;
    this.resetDailyCaches();
    this.loadingDaily.clear();
    if (this.isStudentOrParent) this.reportType = 'student';

    const endpoint = this.reportType === 'student'
      ? `${this.api}/students/attendance/report`
      : `${this.api}/teachers/attendance/report`;

    const params: Record<string, string | number> = {
      month: this.selectedMonth, year: this.selectedYear,
      pageIndex: this.pageIndex, pageSize: this.isStudentOrParent ? 9999 : this.pageSize
    };
    if (this.searchQuery.trim()) params['search'] = this.searchQuery.trim();
    if (this.reportType === 'student') {
      if (this.isStudentOrParent) { params['stream'] = this.studentStreamMode; }
      else {
        if (this.studentFilterMode === 'school') {
          params['stream'] = 'school';
          if (this.selectedClassId) params['classId'] = this.selectedClassId;
          if (this.selectedSectionId) params['sectionId'] = this.selectedSectionId;
        } else if (this.studentFilterMode === 'coaching') {
          params['stream'] = 'coaching';
          if (this.selectedBatchId) params['batchId'] = this.selectedBatchId;
        }
      }
    }

    this.http.get<AttendanceReport>(endpoint, { params }).subscribe({
      next: report => {
        this.report = report;
        this.totalCount = report.totalCount ?? report.totalPeople ?? report.rows?.length ?? 0;
        this.loading = false;
        if (this.isStudentOrParent && report?.rows?.length > 0) {
          const firstRow = report.rows[0];
          if (!this.streamInitialized) {
            this.streamInitialized = true;
            if (report.defaultStream) { this.studentStreamMode = report.defaultStream as any; }
            else if (firstRow.isSchoolStudent && firstRow.isCoachingStudent) { this.studentStreamMode = 'all'; }
            else if (!firstRow.isSchoolStudent && firstRow.isCoachingStudent) { this.studentStreamMode = 'coaching'; }
          }
          this.expandedPersonIds.add(firstRow.personId);
          this.loadDailyAttendanceIfNeeded(firstRow.personId);
        }
      },
      error: () => { this.report = null; this.totalCount = 0; this.loading = false; }
    });
  }

  get overallAttendanceRate(): number {
    if (!this.report || this.report.rows.length === 0) return 0;
    return Math.round(this.report.rows.reduce((a, r) => a + (r.attendancePercentage || 0), 0) / this.report.rows.length);
  }

  get totalWorkingDaysInMonth(): number {
    if (this.report?.rows?.length) return this.report.rows[0].totalWorkingDays;
    const dm = this.getDaysInMonth(); let s = 0;
    for (let d = 1; d <= dm; d++) { if (new Date(this.selectedYear, this.selectedMonth - 1, d).getDay() === 0) s++; }
    return Math.max(0, dm - s);
  }

  getDaysInMonth(): number { return new Date(this.selectedYear, this.selectedMonth, 0).getDate(); }

  getEvaluatedDays(row: ReportRow): number {
    return (row.presentDays||0)+(row.absentDays||0)+(row.lateDays||0)+(row.halfDays||0)+this.getLeaveDays(row);
  }
  getLeaveDays(row: ReportRow): number {
    const m = this.dailyMatrixCache[row.personId]; return m ? m.filter(d => d.status === 'L').length : 0;
  }
  getUnmarkedDays(row: ReportRow): number { return Math.max(0, (row.totalWorkingDays||25) - this.getEvaluatedDays(row)); }

  getInitials(name?: string): string {
    if (!name) return 'ST';
    const p = name.trim().split(/\s+/);
    return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : (name).slice(0,2).toUpperCase();
  }

  resetDailyCaches(): void {
    this.dailyMatrixCache = {};
    this.dailyCalendarCache = {};
    this.streakCache = {};
    this.weeklyPatternCache = {};
  }

  getPctColor(pct: number): string {
    if (pct >= 85) return '#059669'; if (pct >= 75) return '#16a34a'; if (pct >= 50) return '#d97706'; return '#e11d48';
  }

  // === Google-Style Attendance Intelligence Helpers ===
  getStreak(row: ReportRow): { current: number; max: number; label: string } {
    if (this.streakCache[row.personId]) return this.streakCache[row.personId];
    const days = this.getDailyMatrix(row);
    if (!days || days.length === 0) return { current: 0, max: 0, label: 'No Data' };

    let max = 0;
    let running = 0;
    for (const d of days) {
      if (d.status === 'P' || d.status === 'LT') {
        running++;
        if (running > max) max = running;
      } else if (d.status === 'A' || d.status === 'HD') {
        running = 0;
      }
    }

    let tailStreak = 0;
    const evaluated = days.filter(d => d.status !== '-' && !d.isSunday && d.status !== 'H');
    for (let i = evaluated.length - 1; i >= 0; i--) {
      const s = evaluated[i].status;
      if (s === 'P' || s === 'LT') {
        tailStreak++;
      } else if (s === 'A' || s === 'HD') {
        break;
      }
    }

    let label = 'Active Streak';
    if ((row.absentDays || 0) === 0 && (row.presentDays || 0) > 0) {
      label = 'Perfect Streak';
    } else if (tailStreak >= 10) {
      label = 'Super Regular';
    } else if (tailStreak >= 5) {
      label = 'Solid Run';
    }

    const res = { current: tailStreak, max: Math.max(max, tailStreak), label };
    this.streakCache[row.personId] = res;
    return res;
  }

  getPunctualityRate(row: ReportRow): number {
    const present = row.presentDays || 0;
    if (present === 0) return 100;
    const late = row.lateDays || 0;
    const onTime = Math.max(0, present - late);
    return Math.round((onTime / present) * 100);
  }

  getLastPunchInfo(row: ReportRow): DailyDayItem | null {
    const days = this.getDailyMatrix(row);
    if (!days || days.length === 0) return null;
    for (let i = days.length - 1; i >= 0; i--) {
      const d = days[i];
      if (d.checkInTime || d.status === 'P' || d.status === 'LT') {
        return d;
      }
    }
    return null;
  }

  getWeeklyPattern(row: ReportRow): Array<{ name: string; present: number; total: number; pct: number }> {
    if (this.weeklyPatternCache[row.personId]) return this.weeklyPatternCache[row.personId];
    const days = this.getDailyMatrix(row);
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map: { [k: string]: { present: number; total: number } } = {};
    for (const name of dayNames) map[name] = { present: 0, total: 0 };

    for (const d of days) {
      if (map[d.dayOfWeek]) {
        if (d.status !== '-' && d.status !== 'OFF') {
          map[d.dayOfWeek].total++;
          if (d.status === 'P' || d.status === 'LT') {
            map[d.dayOfWeek].present++;
          }
        }
      }
    }

    const res = dayNames.map(name => {
      const item = map[name];
      const pct = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
      return { name, present: item.present, total: item.total, pct };
    });
    this.weeklyPatternCache[row.personId] = res;
    return res;
  }

  getDisciplineBadge(row: ReportRow): { text: string; subtext: string; icon: string; theme: string } {
    const pct = row.attendancePercentage || 0;
    if (pct >= 95) {
      return { text: 'Outstanding Attendance', subtext: 'Exemplary Regularity', icon: 'workspace_premium', theme: 'badge-elite' };
    }
    if (pct >= 85) {
      return { text: 'Consistent & On Track', subtext: 'High Regularity', icon: 'verified', theme: 'badge-good' };
    }
    if (pct >= 75) {
      return { text: 'Satisfactory', subtext: 'Meets Criteria', icon: 'check_circle', theme: 'badge-warn' };
    }
    return { text: 'Attention Required', subtext: 'Below 75% Requirement', icon: 'warning', theme: 'badge-low' };
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'P': return 'check_circle';
      case 'A': return 'cancel';
      case 'L': return 'event_busy';
      case 'LT': return 'schedule';
      case 'HD': return 'timelapse';
      case 'H': return 'celebration';
      case 'OFF': return 'weekend';
      default: return 'remove';
    }
  }

  isExpanded(personId: string): boolean { return this.expandedPersonIds.has(personId); }
  isCollapsing(personId: string): boolean { return this.collapsingPersonIds.has(personId); }

  toggleCalendar(personId: string): void {
    if (this.expandedPersonIds.has(personId)) {
      this.expandedPersonIds.delete(personId);
      this.collapsingPersonIds.add(personId);
      setTimeout(() => this.collapsingPersonIds.delete(personId), 220);
    } else {
      const prev = [...this.expandedPersonIds];
      this.expandedPersonIds.clear();
      prev.forEach(pid => { this.collapsingPersonIds.add(pid); setTimeout(() => this.collapsingPersonIds.delete(pid), 220); });
      this.expandAll = false;
      this.expandedPersonIds.add(personId);
      this.loadDailyAttendanceIfNeeded(personId);
    }
  }

  toggleExpandAll(): void {
    this.expandAll = !this.expandAll;
    if (this.expandAll) {
      this.collapsingPersonIds.clear();
      (this.report?.rows||[]).forEach(r => { this.expandedPersonIds.add(r.personId); this.loadDailyAttendanceIfNeeded(r.personId); });
    } else {
      const open = [...this.expandedPersonIds]; this.expandedPersonIds.clear();
      open.forEach(pid => { this.collapsingPersonIds.add(pid); setTimeout(() => this.collapsingPersonIds.delete(pid), 220); });
    }
  }

  loadDailyAttendanceIfNeeded(personId: string): void {
    if (this.dailyMatrixCache[personId] || this.loadingDaily.has(personId)) return;
    this.loadingDaily.add(personId);
    let sq = '';
    if (this.reportType === 'student') {
      if (this.isStudentOrParent) sq = `&stream=${this.studentStreamMode}`;
      else if (this.studentFilterMode === 'school') sq = '&stream=school';
      else if (this.studentFilterMode === 'coaching') sq = '&stream=coaching';
    }
    const ep = this.reportType === 'student'
      ? `${this.api}/students/${personId}/attendance?month=${this.selectedMonth}&year=${this.selectedYear}${sq}`
      : `${this.api}/teachers/${personId}/attendance?month=${this.selectedMonth}&year=${this.selectedYear}`;
    this.http.get<any[]>(ep).subscribe({
      next: r => { this.loadingDaily.delete(personId); this.buildDailyMapFromRecords(personId, r||[]); },
      error: () => { this.loadingDaily.delete(personId); this.buildDailyMapFromRecords(personId, []); }
    });
  }

  buildDailyMapFromRecords(personId: string, records: any[]): void {
    const totalDays = this.getDaysInMonth();
    const daysArr: DailyDayItem[] = [];
    const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(this.selectedYear, this.selectedMonth - 1, d);
      const dayOfWeek = weekdays[dateObj.getDay()];
      const isSunday = dateObj.getDay() === 0;

      // Check Holiday
      const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const matchedHoliday = this.holidays.find(h => {
        const start = (h.startDate || '').split('T')[0];
        const end = (h.endDate || h.startDate || '').split('T')[0];
        return ymd >= start && ymd <= end;
      });
      const hTitle = matchedHoliday ? (matchedHoliday.title || matchedHoliday.name) : undefined;

      if (isSunday) {
        const lbl = hTitle
          ? `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Sunday • Holiday: ${hTitle}`
          : `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Sunday (Weekly Off)`;
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: true,
          status: 'OFF',
          label: lbl,
          statusText: hTitle ? `Sunday (${hTitle})` : 'Sunday (Weekly Off)',
          holidayTitle: hTitle
        });
        continue;
      }

      const rec = records.find(r => {
        let rY: number, rM: number, rD: number;
        if (typeof r.attendanceDate === 'string' && r.attendanceDate.length >= 10) {
          const p = r.attendanceDate.substring(0, 10).split('-');
          rY = +p[0]; rM = +p[1]; rD = +p[2];
        } else {
          const dt = new Date(r.attendanceDate);
          rY = dt.getFullYear(); rM = dt.getMonth() + 1; rD = dt.getDate();
        }
        return rD === d && rM === Number(this.selectedMonth) && rY === Number(this.selectedYear);
      });

      if (rec) {
        let code = 'P';
        const st = (rec.status || '').toLowerCase();
        if (st.includes('absent')) code = 'A';
        else if (st.includes('leave')) code = 'L';
        else if (st.includes('late')) code = 'LT';
        else if (st.includes('half')) code = 'HD';
        else if (st.includes('holiday') || st.includes('off')) code = 'H';

        let statusText = rec.status || 'Present';
        const leaveRemarks = rec.remarks || '';
        if (code === 'L') {
          statusText = leaveRemarks ? `Leave: ${leaveRemarks}` : 'Sanctioned Leave';
        }
        const sl = rec.captureSource === 'ManualBulk' ? 'Coaching' : (rec.captureSource?.startsWith('ManualSchool') ? 'School' : (rec.captureSource || ''));
        const sourceStr = sl ? ` • ${sl}` : '';
        const inTimeStr = rec.checkInTime ? ` • In: ${rec.checkInTime}` : '';

        let fullLabel = `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): ${statusText}${sourceStr}${inTimeStr}`;
        if (hTitle && code !== 'H') {
          fullLabel += ` [Holiday: ${hTitle}]`;
        }

        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: code,
          label: fullLabel,
          statusText: statusText,
          remarks: leaveRemarks || undefined,
          holidayTitle: hTitle,
          checkInTime: rec.checkInTime || undefined,
          captureSource: sl || undefined
        });
      } else if (matchedHoliday) {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: 'H',
          label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Holiday - ${hTitle}`,
          statusText: `Holiday: ${hTitle}`,
          holidayTitle: hTitle
        });
      } else {
        daysArr.push({
          day: d,
          dayOfWeek,
          isSunday: false,
          status: '-',
          label: `${d} ${this.months[this.selectedMonth - 1]} (${dayOfWeek}): Not Marked / Future`,
          statusText: 'Not Marked'
        });
      }
    }
    this.dailyMatrixCache[personId] = daysArr;
    delete this.dailyCalendarCache[personId];
    delete this.streakCache[personId];
    delete this.weeklyPatternCache[personId];
  }

  getDailyMatrix(row: ReportRow): DailyDayItem[] {
    if (this.dailyMatrixCache[row.personId]) return this.dailyMatrixCache[row.personId];
    this.loadDailyAttendanceIfNeeded(row.personId);
    const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return Array.from({length: this.getDaysInMonth()}, (_, i) => {
      const d = i+1; const dt = new Date(this.selectedYear, this.selectedMonth-1, d);
      const dow = wd[dt.getDay()]; const sun = dt.getDay()===0;
      const ymd = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const matchedH = this.holidays.find(h => {
        const start = (h.startDate || '').split('T')[0];
        const end = (h.endDate || h.startDate || '').split('T')[0];
        return ymd >= start && ymd <= end;
      });
      const hTitle = matchedH ? (matchedH.title || matchedH.name) : undefined;
      const isH = !sun && !!matchedH;
      return {
        day: d,
        dayOfWeek: dow,
        isSunday: sun,
        status: sun ? 'OFF' : (isH ? 'H' : '-'),
        label: sun
          ? (hTitle ? `${d} ${this.months[this.selectedMonth-1]} (${dow}): Sunday • ${hTitle}` : `${d} ${this.months[this.selectedMonth-1]} (${dow}): Sunday (Weekly Off)`)
          : (isH ? `${d} ${this.months[this.selectedMonth-1]} (${dow}): Holiday - ${hTitle}` : `${d} ${this.months[this.selectedMonth-1]} (${dow})`),
        statusText: sun ? 'Weekly Off' : (isH ? `Holiday: ${hTitle}` : 'Not Marked'),
        holidayTitle: hTitle
      };
    });
  }

  getSelectedBatchName(): string {
    if (!this.selectedBatchId) return 'All Batches';
    return this.batches.find(b => b.id === this.selectedBatchId)?.name || 'All Batches';
  }

  getSelectedFilterSubTitle(): string {
    if (this.studentFilterMode === 'school') {
      const cls = this.schoolClasses.find(c => c.id === this.selectedClassId);
      const sec = this.classSections.find(s => s.id === this.selectedSectionId);
      if (cls && sec) return `School Class: ${cls.name} (Section ${sec.name})`;
      if (cls) return `School Class: ${cls.name}`;
      return 'All School Classes';
    }
    if (this.studentFilterMode === 'coaching') return `Coaching Batch: ${this.getSelectedBatchName()}`;
    return 'All Students (School & Coaching)';
  }

  exportCsv(): void {
    if (!this.report || this.sortedRows.length === 0) return;
    const tl = this.reportType === 'student' ? 'Student' : 'Faculty';
    const cl = this.reportType === 'student' ? 'Roll Number' : 'Code';
    const gl = this.reportType === 'student' ? 'Batch / Class' : 'Department';
    let csv = `"${tl} Attendance Report - ${this.months[this.selectedMonth-1]} ${this.selectedYear}"\n`;
    if (this.reportType === 'student') csv += `"${this.getSelectedFilterSubTitle()}"\n`;
    csv += `\n"Name","${cl}","${gl}","Present Days","Absent Days","Late Days","Half Days","Off Days","Total Working Days","Attendance %"\n`;
    for (const r of this.sortedRows) {
      csv += `"${r.personName||''}","${r.code||''}","${r.groupName||''}",${r.presentDays||0},${r.absentDays||0},${r.lateDays||0},${r.halfDays||0},${r.holidayDays||0},${r.totalWorkingDays||0},"${r.attendancePercentage||0}%"\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${this.reportType}_attendance_report_${this.selectedYear}_${this.selectedMonth}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  printReport(): void { window.print(); }
}
