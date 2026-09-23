import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
  maxMarks: number;
  roomNo: string;
}

@Component({
  selector: 'app-school-report-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
    MatProgressBarModule
  ],
  templateUrl: './school-report-card-dialog.component.html',
  styleUrls: ['./school-report-card-dialog.component.scss']
})
export class SchoolReportCardDialogComponent implements OnInit {
  currentView: 'bseb_marksheet' | 'marksheet' | 'admit_card' | 'result_card' | 'certificate' = 'bseb_marksheet';
  isBulkMode = false;
  activeStudent: ConsolidatedStudentResultDto | null = null;
  studentsToRender: ConsolidatedStudentResultDto[] = [];
  
  instituteName = 'School of Excellence';
  branchAddress = '';
  todayDate = '';
  sendingWhatsApp = false;

  constructor(
    public dialogRef: MatDialogRef<SchoolReportCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SchoolReportCardDialogData,
    private schoolService: SchoolService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService
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
  }

  getViewTitle(): string {
    const count = this.studentsToRender.length;
    switch (this.currentView) {
      case 'bseb_marksheet':
        return this.isBulkMode ? `Bulk Bihar Board Marksheets (${count} Students)` : 'Bihar Board Format Marksheet (बिहार बोर्ड अंक विवरण)';
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
    window.print();
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

  // ─── BSEB Specific Helpers ───
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
    return `BSEB/SEC/${num}`;
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
    const subjects = st.subjectDetails?.length > 0 ? st.subjectDetails.map(s => s.subject) : this.data.subjects;
    const exams = this.data.exams || [];

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

      list.push({
        slNo: i + 1,
        subject: sub,
        dateStr,
        dayStr,
        timeStr: '09:30 AM - 12:45 PM (1st Shift)',
        maxMarks,
        roomNo: `Hall-${String.fromCharCode(65 + (i % 3))} / Rm ${101 + (i % 5)}`
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
