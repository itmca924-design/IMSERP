import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { environment } from '../../../environments/environment';
import {
  SchoolService,
  ConsolidatedStudentResultDto,
  ConsolidatedSubjectDetailDto,
  ExamSettingDto,
  SendAnnualResultWhatsAppDto,
  SchoolExamDto
} from '../../core/services/school.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

export interface SchoolReportCardDialogData {
  mode: 'single' | 'bulk' | 'certificate' | 'admit_card' | 'result_card' | 'bseb_marksheet';
  className: string;
  academicYear: string;
  examType: string;
  student?: ConsolidatedStudentResultDto;
  allStudents?: ConsolidatedStudentResultDto[];
  settings?: ExamSettingDto;
  subjects: string[];
  exams?: SchoolExamDto[];
  initialView?: 'bseb_marksheet' | 'marksheet' | 'admit_card' | 'result_card' | 'certificate';
}

export interface ExamRoutineItem {
  slNo: number;
  subject: string;
  dateStr: string;
  dayStr: string;
  timeStr: string;
  durationStr: string;
  maxMarks: number;
  roomNo: string;
}

@Component({
  selector: 'app-school-report-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule
  ],
  templateUrl: './school-report-card-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./school-report-card-dialog.component.scss']
})
export class SchoolReportCardDialogComponent implements OnInit, OnDestroy {
  currentView: 'bseb_marksheet' | 'marksheet' | 'admit_card' | 'result_card' | 'certificate' = 'bseb_marksheet';
  isBulkMode = false;
  activeStudent: ConsolidatedStudentResultDto | null = null;
  studentsToRender: ConsolidatedStudentResultDto[] = [];
  
  instituteName = 'School of Excellence';
  branchAddress = '';
  todayDate = '';
  sendingWhatsApp = false;
  logoImgFailed = false;

  // Auto-synced Hall & Seating lookup + User Manual Override controls
  seatLookupMap = new Map<string, { roomName: string; seatNumber: string; examStartTime?: string; examEndTime?: string }>();
  syncedSeatCount = 0;
  manualHallControl = new FormControl('');
  manualTimingControl = new FormControl('');

  get instituteLogo(): string | null {
    return this.authService.getInstituteLogoUrl();
  }

  get officialSealUrl(): string | null {
    const fromSettings = this.data.settings?.officialSealUrl;
    if (fromSettings) return this.authService.resolveLogoUrl(fromSettings);
    return this.authService.getOfficialSealUrl();
  }

  get principalSignatureUrl(): string | null {
    const fromSettings = this.data.settings?.principalSignatureUrl;
    if (fromSettings) return this.authService.resolveLogoUrl(fromSettings);
    return this.authService.getDigitalSignatureUrl();
  }

  getPhotoUrl(photo?: string | null): string {
    return this.authService.resolveLogoUrl(photo) || '';
  }

  onLogoImgError(): void {
    this.logoImgFailed = true;
  }

  constructor(
    public dialogRef: MatDialogRef<SchoolReportCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchoolReportCardDialogData,
    private schoolService: SchoolService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (user?.instituteName) {
      this.instituteName = user.instituteName;
    }
    if (user?.branchName) {
      this.branchAddress = user.branchName;
    }

    const today = new Date();
    this.todayDate = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (this.data.mode === 'bulk') {
      this.isBulkMode = true;
      this.currentView = this.data.initialView || 'bseb_marksheet';
      this.studentsToRender = this.data.allStudents || [];
      if (this.studentsToRender.length > 0) {
        this.activeStudent = this.studentsToRender[0];
      }
    } else {
      this.isBulkMode = false;
      if (this.data.initialView) {
        this.currentView = this.data.initialView;
      } else if (this.data.mode === 'bseb_marksheet') {
        this.currentView = 'bseb_marksheet';
      } else if (this.data.mode === 'admit_card') {
        this.currentView = 'admit_card';
      } else if (this.data.mode === 'result_card') {
        this.currentView = 'result_card';
      } else if (this.data.mode === 'certificate') {
        this.currentView = 'certificate';
      } else {
        this.currentView = 'bseb_marksheet';
      }
      this.activeStudent = this.data.student || null;
      if (this.activeStudent) {
        this.studentsToRender = [this.activeStudent];
      }
    }

    this.loadSyncedExamSeating();
  }

  private loadSyncedExamSeating(): void {
    const testIds = (this.data.exams || []).map(e => e.id).filter(Boolean);
    if (testIds.length === 0) return;

    this.http.post<any>(`${environment.apiUrl}/coaching-ai-exam/seating/by-tests`, { testIds }).subscribe({
      next: res => {
        this.seatLookupMap.clear();
        const list = res?.seats || [];
        for (const s of list) {
          this.seatLookupMap.set(`${s.testId}_${s.studentId}`, {
            roomName: s.roomName,
            seatNumber: s.seatNumber,
            examStartTime: s.examStartTime,
            examEndTime: s.examEndTime
          });
        }
        this.syncedSeatCount = list.length;
      },
      error: () => {}
    });
  }

  resetManualOverrides(): void {
    this.manualHallControl.setValue('');
    this.manualTimingControl.setValue('');
  }

  private formatTime12h(hhmm?: string): string {
    if (!hhmm) return '';
    const parts = hhmm.trim().split(':');
    if (parts.length < 2) return hhmm;
    let h = parseInt(parts[0], 10);
    const m = parts[1].substring(0, 2);
    if (isNaN(h)) return hhmm;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  private computeDurationLabel(rangeOrStart?: string, endTime?: string): string {
    const parseTimeToken = (tok: string): number | null => {
      const m = tok.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!m) return null;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h < 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };

    let startMin: number | null = null;
    let endMin: number | null = null;

    if (rangeOrStart && endTime) {
      startMin = parseTimeToken(rangeOrStart);
      endMin = parseTimeToken(endTime);
    } else if (rangeOrStart && rangeOrStart.includes('-')) {
      const parts = rangeOrStart.split('-');
      if (parts.length >= 2) {
        startMin = parseTimeToken(parts[0]);
        endMin = parseTimeToken(parts[1]);
      }
    }

    if (startMin !== null && endMin !== null) {
      let diff = endMin - startMin;
      if (diff <= 0) diff += 12 * 60;
      if (diff > 0 && diff <= 720) {
        const hrs = Math.floor(diff / 60);
        const mins = diff % 60;
        if (hrs > 0 && mins > 0) return `${hrs} ${hrs === 1 ? 'Hr' : 'Hrs'} ${mins} Mins`;
        if (hrs > 0) return `${hrs} ${hrs === 1 ? 'Hr' : 'Hrs'}`;
        return `${mins} Mins`;
      }
    }
    return '3 Hrs';
  }

  getViewTitle(): string {
    const count = this.studentsToRender.length;
    switch (this.currentView) {
      case 'bseb_marksheet':
        return this.isBulkMode ? `Bulk Board Style Marksheets (${count} Students)` : 'Board Style Marksheet (बोर्ड प्रारूप अंक विवरण)';
      case 'admit_card':
        return this.isBulkMode ? `Bulk Class Admit Cards (${count} Students)` : 'Examination Admit Card (प्रवेश पत्र / हॉल टिकट)';
      case 'result_card':
        return this.isBulkMode ? `Bulk Student Result Cards (${count} Students)` : 'Student Result Summary Card (परीक्षाफल पत्रक)';
      case 'certificate':
        return this.isBulkMode ? `Bulk Promotion Certificates (${count} Students)` : 'Annual Pass & Promotion Certificate';
      default:
        return this.isBulkMode ? `Bulk Progress Report Cards (${count} Students)` : 'Annual Progress Report & Marksheet';
    }
  }

  printDocument(): void {
    document.body.classList.add('printing-report-card');
    const cleanup = () => {
      document.body.classList.remove('printing-report-card');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2000);
    }, 50);
  }

  ngOnDestroy(): void {
    document.body.classList.remove('printing-report-card');
  }

  // ─── Dynamic School Rubber Seal Helpers ───
  getSealTopText(): string {
    const name = (this.instituteName || 'School of Excellence').toUpperCase().trim();
    if (name.length > 36) {
      return name.slice(0, 34) + '..';
    }
    return name;
  }

  getSealTopFontSize(): string {
    const len = (this.instituteName || '').trim().length;
    if (len > 28) return '5.4px';
    if (len > 22) return '6.2px';
    return '7.2px';
  }

  getSealBottomText(): string {
    const loc = (this.branchAddress || 'Main Campus').toUpperCase().trim();
    return `★ ${loc.slice(0, 18)} ★`;
  }

  // ─── Multi-Tenant Board Style Helpers ───
  getInstitutePrefix(): string {
    if (!this.instituteName) return 'IMS';
    const clean = this.instituteName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0] + (words[2] ? words[2][0] : '')).toUpperCase();
    }
    return clean.slice(0, 3).toUpperCase() || 'IMS';
  }

  getWatermarkText(): string {
    if (!this.instituteName) return 'EXAM';
    return this.instituteName.length > 14 ? this.getInstitutePrefix() : this.instituteName.toUpperCase();
  }

  getBranchCity(): string {
    if (this.branchAddress) {
      const parts = this.branchAddress.split(',');
      if (parts.length > 1) {
        return parts[parts.length - 2].trim().toUpperCase().slice(0, 10);
      }
      return parts[0].trim().toUpperCase().slice(0, 10);
    }
    return 'CAMPUS';
  }

  getExamNameHindi(): string {
    const t = (this.data.examType || '').toLowerCase();
    if (t.includes('annual') || t.includes('final')) return 'वार्षिक परीक्षा';
    if (t.includes('half')) return 'अर्धवार्षिक परीक्षा';
    if (t.includes('unit')) return 'इकाई परीक्षा';
    if (t.includes('term')) return 'सत्र परीक्षा';
    return 'वार्षिक माध्यमिक परीक्षा';
  }

  getRollCode(): string {
    if (this.data.settings?.schoolAffiliationNumber) {
      const digits = this.data.settings.schoolAffiliationNumber.replace(/\D/g, '');
      if (digits.length >= 5) return digits.slice(0, 5);
    }
    return '11025';
  }

  getRegNo(st: ConsolidatedStudentResultDto): string {
    const yr = this.data.academicYear ? this.data.academicYear.slice(-2) : '26';
    const roll = st.rollNumber ? st.rollNumber.toString().padStart(4, '0') : '0001';
    return `R-${this.getRollCode()}-${roll}-${yr}`;
  }

  getSerialNumber(st: ConsolidatedStudentResultDto, index: number): string {
    const num = (index + 1).toString().padStart(6, '0');
    return `${this.getInstitutePrefix()}/MS/${num}`;
  }

  getSubjectCode(subject: string, idx: number): string {
    const s = subject.toLowerCase();
    if (s.includes('hindi')) return '101';
    if (s.includes('sanskrit') || s.includes('urdu') || s.includes('maithili')) return '102';
    if (s.includes('math')) return '103';
    if (s.includes('science') || s.includes('vigyan')) return '104';
    if (s.includes('social') || s.includes('samajik')) return '105';
    if (s.includes('english')) return '106';
    return (101 + idx).toString();
  }

  isPracticalSubject(subject: string): boolean {
    const s = subject.toLowerCase();
    return s.includes('science') || s.includes('vigyan') || s.includes('computer') || s.includes('art') || s.includes('music');
  }

  getSubjectTheoryMax(sub: ConsolidatedSubjectDetailDto): number {
    if (this.isPracticalSubject(sub.subject)) {
      return Math.round(sub.maxMarks * 0.8);
    }
    return sub.maxMarks;
  }

  getSubjectPracticalMax(sub: ConsolidatedSubjectDetailDto): string {
    if (this.isPracticalSubject(sub.subject)) {
      return (sub.maxMarks - Math.round(sub.maxMarks * 0.8)).toString();
    }
    return '-';
  }

  getSubjectTheoryPass(sub: ConsolidatedSubjectDetailDto): number {
    if (this.isPracticalSubject(sub.subject)) {
      return Math.round(sub.passingMarks * 0.8);
    }
    return sub.passingMarks;
  }

  getSubjectPracticalPass(sub: ConsolidatedSubjectDetailDto): string {
    if (this.isPracticalSubject(sub.subject)) {
      return Math.max(1, sub.passingMarks - Math.round(sub.passingMarks * 0.8)).toString();
    }
    return '-';
  }

  getSubjectTheoryObt(sub: ConsolidatedSubjectDetailDto): string {
    if (sub.isAbsent || sub.marksObtained === null || sub.marksObtained === undefined) {
      return '-';
    }
    if (this.isPracticalSubject(sub.subject)) {
      const thMax = Math.round(sub.maxMarks * 0.8);
      const th = Math.min(thMax, Math.round(sub.marksObtained * 0.8));
      return th.toString();
    }
    return sub.marksObtained.toString();
  }

  getSubjectPracticalObt(sub: ConsolidatedSubjectDetailDto): string {
    if (sub.isAbsent || sub.marksObtained === null || sub.marksObtained === undefined) {
      return '-';
    }
    if (this.isPracticalSubject(sub.subject)) {
      const thMax = Math.round(sub.maxMarks * 0.8);
      const th = Math.min(thMax, Math.round(sub.marksObtained * 0.8));
      const pr = Math.max(0, sub.marksObtained - th);
      return pr.toString();
    }
    return '-';
  }

  getSubjectRemark(sub: ConsolidatedSubjectDetailDto): string {
    if (sub.isAbsent) return 'ABS';
    if (!sub.isPassed) return 'FAIL';
    if (sub.marksObtained !== null && sub.maxMarks > 0) {
      const pct = (sub.marksObtained / sub.maxMarks) * 100;
      if (pct >= 75) return 'D';
    }
    return 'P';
  }

  getBsebDivision(st: ConsolidatedStudentResultDto): { en: string; hi: string; class: string } {
    if (st.resultStatus === 'Failed' || st.failedSubjectCount > 0 || st.overallPercentage < 33) {
      if (st.resultStatus === 'Compartment' || st.failedSubjectCount === 1) {
        return { en: 'COMPARTMENT', hi: 'कम्पार्टमेंट', class: 'div-comp' };
      }
      return { en: 'FAIL', hi: 'अनुत्तीर्ण', class: 'div-fail' };
    }
    if (st.overallPercentage >= 60) {
      return { en: 'FIRST DIVISION', hi: 'प्रथम श्रेणी', class: 'div-first' };
    }
    if (st.overallPercentage >= 45) {
      return { en: 'SECOND DIVISION', hi: 'द्वितीय श्रेणी', class: 'div-second' };
    }
    return { en: 'THIRD DIVISION', hi: 'तृतीय श्रेणी', class: 'div-third' };
  }

  // ─── Admit Card Helpers ───
  getExamRoutine(st: ConsolidatedStudentResultDto): ExamRoutineItem[] {
    const list: ExamRoutineItem[] = [];
    const exams = this.data.exams || [];
    const subjects = st.subjectDetails?.length > 0
      ? st.subjectDetails.map(s => s.subject)
      : (this.data.subjects?.length > 0 ? this.data.subjects : exams.map(e => e.subject));

    const manualHall = (this.manualHallControl.value || '').trim();
    const manualTiming = (this.manualTimingControl.value || '').trim();

    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + ((1 + 7 - baseDate.getDay()) % 7 || 7));

    subjects.forEach((sub, i) => {
      const matchedExam = exams.find(e => e.subject.toLowerCase() === sub.toLowerCase());
      let dateStr = '';
      let dayStr = '';

      if (matchedExam && matchedExam.testDate) {
        const d = new Date(matchedExam.testDate);
        dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        dayStr = d.toLocaleDateString('en-GB', { weekday: 'long' });
      } else {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + (i * 2));
        dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        dayStr = d.toLocaleDateString('en-GB', { weekday: 'long' });
      }

      const maxMarks = matchedExam?.maxMarks || (st.subjectDetails?.find(s => s.subject === sub)?.maxMarks) || 100;
      const syncedSeat = matchedExam ? this.seatLookupMap.get(`${matchedExam.id}_${st.studentId}`) : undefined;

      const resolvedRoom = manualHall
        ? manualHall
        : (syncedSeat ? `${syncedSeat.roomName} (Seat: ${syncedSeat.seatNumber})` : 'As Allotted');

      const resolvedTime = manualTiming
        ? manualTiming
        : (syncedSeat?.examStartTime && syncedSeat?.examEndTime
            ? `${this.formatTime12h(syncedSeat.examStartTime)} - ${this.formatTime12h(syncedSeat.examEndTime)}`
            : '09:30 AM - 12:30 PM');

      const durationStr = manualTiming
        ? this.computeDurationLabel(manualTiming)
        : (syncedSeat?.examStartTime && syncedSeat?.examEndTime
            ? this.computeDurationLabel(syncedSeat.examStartTime, syncedSeat.examEndTime)
            : '3 Hrs');

      list.push({
        slNo: i + 1,
        subject: sub,
        dateStr,
        dayStr,
        timeStr: resolvedTime,
        durationStr,
        maxMarks,
        roomNo: resolvedRoom
      });
    });

    return list;
  }

  sendWhatsApp(): void {
    if (!this.activeStudent) return;

    const phone = this.activeStudent.parentWhatsAppPhone;
    if (!phone) {
      this.confirmDialog.alert(
        'WhatsApp Number Missing',
        `Parent's WhatsApp contact number is not recorded for ${this.activeStudent.studentName}. Please update student profile.`,
        'warning'
      );
      return;
    }

    this.sendingWhatsApp = true;
    const payload: SendAnnualResultWhatsAppDto = {
      studentId: this.activeStudent.studentId,
      studentName: this.activeStudent.studentName,
      recipientPhone: phone,
      examTitle: `${this.data.className} ${this.data.examType || 'Annual Examination'}`,
      academicYear: this.data.academicYear,
      totalObtained: this.activeStudent.totalObtained,
      totalMax: this.activeStudent.totalMax,
      percentage: this.activeStudent.overallPercentage,
      grade: this.activeStudent.grade,
      resultStatus: this.activeStudent.resultStatus,
      rank: this.activeStudent.rank > 0 ? this.activeStudent.rank : undefined
    };

    this.schoolService.sendAnnualResultWhatsApp(payload).subscribe({
      next: (res) => {
        this.sendingWhatsApp = false;
        this.confirmDialog.alert('WhatsApp Sent! 📱', res.message || 'Result summary successfully sent to parent.', 'success');
      },
      error: () => {
        this.sendingWhatsApp = false;
        const msg = encodeURIComponent(
          `*${this.instituteName} - ANNUAL EXAM RESULT (${this.data.academicYear})*\n\n` +
          `Dear Parent, performance report for *${this.activeStudent?.studentName}* (Roll: ${this.activeStudent?.rollNumber}, Class: ${this.data.className}):\n` +
          `• Total Marks: *${this.activeStudent?.totalObtained} / ${this.activeStudent?.totalMax}* (${this.activeStudent?.overallPercentage}%)\n` +
          `• Division: *${this.getBsebDivision(this.activeStudent!).en}* (${this.activeStudent?.resultStatus})\n` +
          `• Overall Grade: *${this.activeStudent?.grade}* | Class Rank: *#${this.activeStudent?.rank || '1'}*\n\n` +
          `Congratulations on completing the examination!`
        );
        window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
      }
    });
  }
}
