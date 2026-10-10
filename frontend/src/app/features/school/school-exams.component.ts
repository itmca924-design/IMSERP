import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  SchoolService,
  SchoolClassDto,
  SchoolSectionDto,
  SchoolExamDto,
  CreateBulkSchoolExamsDto,
  SchoolExamMarksItemDto,
  SaveSchoolExamMarksDto,
  ConsolidatedClassResultDto,
  ConsolidatedStudentResultDto,
  ExamSettingDto,
  UpdateExamSettingDto,
  BlankAwardSheetDto,
  BlankAwardSheetItemDto,
  UpdateExamEvaluationWorkflowDto,
  LockExamMarksDto
} from '../../core/services/school.service';
import { SubjectsService, SubjectDto, ClassSubjectDto } from '../../core/services/subjects.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { SchoolReportCardDialogComponent } from './school-report-card-dialog.component';
import { SchoolClassMarksMatrixDialogComponent, SchoolClassMarksMatrixDialogData } from './school-class-marks-matrix-dialog.component';
import { IstDatetimeDirective } from '../../shared/directives/ist-datetime.directive';

@Component({
  selector: 'app-school-exams',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    MatTableModule,
    MatTabsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    IstDatetimeDirective
  ],
  templateUrl: './school-exams.component.html',
  styleUrls: ['./school-exams.component.scss']
})
export class SchoolExamsComponent implements OnInit {
  // Navigation & Tabs
  activeTabIndex = 0;

  // Master Data
  classes: SchoolClassDto[] = [];
  sections: SchoolSectionDto[] = [];
  allSubjects: SubjectDto[] = [];

  // Filters for Exams List (Tab 1)
  filterClassId = '';
  filterSectionId = '';
  filterAcademicYear = '2025-2026';
  availableSessions: string[] = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
  filterExamType = '';
  searchTerm = '';
  exams: SchoolExamDto[] = [];
  loadingExams = false;

  // Scheduler (Tab 2)
  scheduleForm: FormGroup;
  savingSchedule = false;

  // Consolidated Results (Tab 3)
  resultClassId = '';
  resultSectionId = '';
  resultAcademicYear = '2025-2026';
  resultExamType = 'Annual Exam';
  consolidatedResult: ConsolidatedClassResultDto | null = null;
  loadingResults = false;

  // Dynamic Exam Evaluation & Passing Benchmark Settings (GAP 4)
  examSettings: ExamSettingDto | null = null;
  settingPassingPercentage = 33;
  settingMaxCompartment = 2;
  settingAllowGrace = true;
  settingMaxGrace = 5;
  savingSettings = false;
  showSettingsBar = false;

  // Teachers Master Data
  teachers: any[] = [];
  teacherSearchTerm = '';

  // Copy Evaluation Tracking Modal
  showEvaluationModal = false;
  selectedExamForEvaluation: SchoolExamDto | null = null;
  evaluatorTeacherId = '';
  evaluationStatus = 'Scheduled';
  evaluationDueDate = '';
  totalCopiesIssued: number | null = null;
  copiesSubmittedDate = '';
  evaluationRemarks = '';
  savingEvaluationWorkflow = false;

  // Blank Award Sheet Modal
  showAwardSheetModal = false;
  loadingAwardSheet = false;
  awardSheetData: BlankAwardSheetDto | null = null;

  // Locking state
  lockingExamId: string | null = null;

  // Marks Entry Overlay
  activeExamForMarks: SchoolExamDto | null = null;
  marksList: SchoolExamMarksItemDto[] = [];
  marksFilterText = '';
  loadingMarks = false;
  savingMarks = false;

  targetExamIdToAutoOpen: string | null = null;
  highlightedExamId: string | null = null;

  constructor(
    private schoolService: SchoolService,
    private subjectsService: SubjectsService,
    private confirmDialog: ConfirmDialogService,
    public authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog
  ) {
    this.scheduleForm = this.fb.group({
      classId: ['', Validators.required],
      sectionId: [''],
      academicYear: ['2025-2026', Validators.required],
      examType: ['Annual Exam', Validators.required],
      startDate: [this.getDefaultExamStartDate(), Validators.required],
      examSpacing: ['daily', Validators.required],
      defaultMaxMarks: [100, [Validators.required, Validators.min(1)]],
      defaultPassingMarks: [33, [Validators.required, Validators.min(1)]],
      exams: this.fb.array([])
    });
  }

  get isTeacher(): boolean {
    return this.authService.isTeacher() && !this.authService.isAdmin();
  }

  get currentTeacher(): any | null {
    const user = this.authService.currentUser();
    if (!user) return null;
    return this.teachers.find(t =>
      (user.userId && t.userId && t.userId.toLowerCase() === user.userId.toLowerCase()) ||
      (t.fullName && user.fullName && t.fullName.trim().toLowerCase() === user.fullName.trim().toLowerCase()) ||
      (t.name && user.fullName && t.name.trim().toLowerCase() === user.fullName.trim().toLowerCase()) ||
      (t.fullName && user.username && t.fullName.trim().toLowerCase() === user.username.trim().toLowerCase()) ||
      (user.fullName && (user.fullName.toLowerCase().includes('pappu') || user.username.toLowerCase().includes('pappu')) && t.fullName.toLowerCase().includes('pappu'))
    ) || null;
  }

  get assignedTeacherExams(): SchoolExamDto[] {
    if (!this.isTeacher) return this.exams;
    const t = this.currentTeacher;
    const user = this.authService.currentUser();
    return this.exams.filter(e => {
      if (t && e.evaluatorTeacherId && t.id && e.evaluatorTeacherId.toLowerCase() === t.id.toLowerCase()) return true;
      if (e.evaluatorTeacherName && user?.fullName && e.evaluatorTeacherName.trim().toLowerCase() === user.fullName.trim().toLowerCase()) return true;
      if (e.evaluatorTeacherName && user?.username && e.evaluatorTeacherName.trim().toLowerCase() === user.username.trim().toLowerCase()) return true;
      if (user && (user.fullName?.toLowerCase().includes('pappu') || user.username?.toLowerCase().includes('pappu')) && e.evaluatorTeacherName?.toLowerCase().includes('pappu')) return true;
      return false;
    });
  }

  get displayedExams(): SchoolExamDto[] {
    let list = this.assignedTeacherExams;
    if (this.filterClassId) {
      list = list.filter(e => e.classId.toLowerCase() === this.filterClassId.toLowerCase());
    }
    if (this.filterExamType) {
      list = list.filter(e => (e.examType || '').toLowerCase() === this.filterExamType.toLowerCase());
    }
    return list;
  }

  get availableClasses(): SchoolClassDto[] {
    if (this.isTeacher) {
      const assignedClassIds = new Set(this.assignedTeacherExams.map(e => e.classId.toLowerCase()));
      const filtered = this.classes.filter(c => assignedClassIds.has(c.id.toLowerCase()));
      return filtered.length > 0 ? filtered : this.classes;
    }
    return this.classes;
  }

  get availableExamTypes(): string[] {
    if (this.isTeacher) {
      const types = Array.from(new Set(this.assignedTeacherExams.map(e => e.examType).filter(Boolean)));
      if (types.length > 0) return types;
    }
    if (this.examSettings?.availableExamTypes) {
      const types = this.examSettings.availableExamTypes.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) return types;
    }
    return ['Annual Exam', 'Half-Yearly Exam', 'Unit Test 1', 'Unit Test 2', 'Quarterly Exam', 'Pre-Board'];
  }

  getWorkflowStatus(exam: SchoolExamDto): 'Locked' | 'MarksEntered' | 'CopiesEvaluated' | 'CopyChecking' | 'Scheduled' {
    if (exam.isMarksLocked) return 'Locked';
    if (exam.evaluationStatus === 'MarksEntered' || (exam.evaluatedStudents > 0 && exam.evaluatedStudents === exam.totalStudents)) {
      return 'MarksEntered';
    }
    if (exam.evaluationStatus === 'EvaluationCompleted') {
      return 'CopiesEvaluated';
    }
    if (exam.evaluationStatus === 'CopiesUnderEvaluation') {
      return 'CopyChecking';
    }
    return 'Scheduled';
  }

  ngOnInit(): void {
    this.initAcademicYears();
    this.route.queryParams.subscribe(params => {
      const targetId = params['examId'] || params['testId'];
      if (targetId) {
        this.targetExamIdToAutoOpen = targetId;
        this.highlightedExamId = targetId;
        this.activeTabIndex = 0;
        this.filterClassId = '';
        this.filterAcademicYear = '';
        this.filterExamType = '';
      }
    });
    this.loadClasses();
    this.loadTeachers();
    this.loadSubjects();
    this.loadExamSettings();
  }


  initAcademicYears(): void {
    const yr = new Date().getFullYear();
    this.filterAcademicYear = `${yr - 1}-${yr}`;
    this.resultAcademicYear = `${yr - 1}-${yr}`;
    this.scheduleForm.get('academicYear')?.setValue(`${yr - 1}-${yr}`);
  }

  get examRows(): FormArray {
    return this.scheduleForm.get('exams') as FormArray;
  }

  loadClasses(): void {
    this.schoolService.getClasses(true).subscribe({
      next: (res) => {
        this.classes = res;
        if (this.classes.length > 0) {
          if (!this.isTeacher) {
            if (!this.filterClassId) this.filterClassId = this.classes[0].id;
          } else {
            this.filterClassId = '';
          }
          if (!this.resultClassId) this.resultClassId = this.classes[0].id;
          if (!this.scheduleForm.get('classId')?.value) {
            this.scheduleForm.get('classId')?.setValue(this.classes[0].id);
            this.onScheduleClassChange(this.classes[0].id);
          }
        }
        this.loadExams();
      },
      error: () => this.loadExams()
    });
  }

  loadTeachers(): void {
    this.schoolService.getTeachers().subscribe({
      next: (teachers) => {
        this.teachers = teachers || [];
      },
      error: () => {
        this.teachers = [];
      }
    });
  }

  loadSubjects(): void {
    this.subjectsService.getSubjects(true).subscribe({
      next: (res) => {
        this.allSubjects = res;
      }
    });
  }

  onFilterClassChange(classId: string): void {
    this.filterSectionId = '';
    if (classId) {
      this.schoolService.getSections(classId).subscribe({
        next: (secs) => { this.sections = secs; }
      });
    } else {
      this.sections = [];
    }
    this.loadExams();
  }

  loadExams(): void {
    this.loadingExams = true;
    this.schoolService.getSchoolExams({
      classId: (!this.isTeacher ? (this.filterClassId || undefined) : undefined),
      sectionId: this.filterSectionId || undefined,
      academicYear: this.filterAcademicYear || undefined,
      examType: this.filterExamType || undefined,
      searchTerm: this.searchTerm || undefined,
      pageSize: 50
    }).subscribe({
      next: (res) => {
        this.loadingExams = false;
        this.exams = res.items;

        // Auto-select class & exam type for Teacher to match their assigned exams
        if (this.isTeacher) {
          const classIds = Array.from(new Set(this.assignedTeacherExams.map(e => e.classId)));
          if (classIds.length === 1 && !this.filterClassId) {
            this.filterClassId = classIds[0];
          } else if (this.filterClassId && !classIds.includes(this.filterClassId)) {
            this.filterClassId = classIds.length > 0 ? classIds[0] : '';
          }

          const examTypes = Array.from(new Set(this.assignedTeacherExams.map(e => e.examType).filter(Boolean)));
          if (examTypes.length === 1 && !this.filterExamType) {
            this.filterExamType = examTypes[0];
          } else if (this.filterExamType && !examTypes.includes(this.filterExamType)) {
            this.filterExamType = examTypes.length > 0 ? examTypes[0] : '';
          }
        }

        if (this.targetExamIdToAutoOpen) {
          const targetId = this.targetExamIdToAutoOpen;
          const found = this.exams.find(e => e.id.toLowerCase() === targetId.toLowerCase());
          if (found) {
            this.targetExamIdToAutoOpen = null;
            setTimeout(() => {
              this.openMarksEntry(found);
            }, 150);
          }
        }
      },
      error: () => {
        this.loadingExams = false;
      }
    });
  }

  // ─── Scheduler Tab ─────────────────────────────────

  // Class-Wise Curriculum Mapping
  currentClassSubjects: ClassSubjectDto[] = [];
  loadingClassSubjects = false;

  get availableSubjectsForSchedule(): { name: string; isCurriculum: boolean; totalMarks?: number; passingMarks?: number; teacherName?: string }[] {
    const list: { name: string; isCurriculum: boolean; totalMarks?: number; passingMarks?: number; teacherName?: string }[] = [];
    const added = new Set<string>();

    this.currentClassSubjects.forEach(cs => {
      list.push({
        name: cs.subjectName,
        isCurriculum: true,
        totalMarks: cs.totalMarks,
        passingMarks: cs.passingMarks,
        teacherName: cs.teacherName
      });
      added.add(cs.subjectName.toLowerCase());
    });

    this.allSubjects.forEach(s => {
      if (!added.has(s.name.toLowerCase())) {
        list.push({
          name: s.name,
          isCurriculum: false
        });
        added.add(s.name.toLowerCase());
      }
    });

    return list;
  }

  isKnownSubject(subName?: string): boolean {
    if (!subName) return false;
    return this.availableSubjectsForSchedule.some(s => s.name.toLowerCase() === subName.toLowerCase());
  }

  onScheduleClassChange(classId: string): void {
    if (!classId) return;
    this.schoolService.getSections(classId).subscribe({
      next: (secs) => { this.sections = secs; }
    });

    this.loadingClassSubjects = true;
    this.subjectsService.getClassSubjects(classId).subscribe({
      next: (classSubs) => {
        this.loadingClassSubjects = false;
        this.currentClassSubjects = classSubs || [];

        // Auto-populate from curriculum if rows are empty or defaults
        if (this.examRows.length === 0 || this.isDefaultPrefilledRows()) {
          this.populateFromClassCurriculum();
        }
      },
      error: () => {
        this.loadingClassSubjects = false;
        this.currentClassSubjects = [];
      }
    });
  }

  isDefaultPrefilledRows(): boolean {
    if (this.examRows.length === 0) return true;
    const defaultSet = new Set(['mathematics', 'science', 'english', 'social studies', 'hindi']);
    return this.examRows.controls.every(r => defaultSet.has((r.get('subject')?.value || '').toLowerCase()));
  }

  // ─── Date & Sunday Helpers ───────────────────────────
  getDefaultExamStartDate(): string {
    const d = new Date();
    // If today is Saturday, default start next Monday (+2 days); if Sunday, next Monday (+1 day)
    if (d.getDay() === 6) {
      d.setDate(d.getDate() + 2);
    } else if (d.getDay() === 0) {
      d.setDate(d.getDate() + 1);
    }
    return this.formatDateToYMD(d);
  }

  formatDateToYMD(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isSunday(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.getDay() === 0;
    }
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getDay() === 0;
  }

  getDayName(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    let d: Date;
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[d.getDay()];
  }

  autoSequenceExamDates(): void {
    const startStr = this.scheduleForm.get('startDate')?.value || this.getDefaultExamStartDate();
    const spacing = this.scheduleForm.get('examSpacing')?.value || 'daily';

    if (!startStr || this.examRows.length === 0) return;

    const parts = startStr.split('-');
    let curr = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

    // If start date itself is Sunday, advance to Monday
    if (curr.getDay() === 0) {
      curr.setDate(curr.getDate() + 1);
      this.scheduleForm.get('startDate')?.setValue(this.formatDateToYMD(curr));
    }

    const step = spacing === 'alternate' ? 2 : (spacing === 'gap2' ? 3 : 1);

    this.examRows.controls.forEach((row, idx) => {
      if (idx > 0 && spacing !== 'same_day') {
        curr.setDate(curr.getDate() + step);
        // Automatically skip Sunday!
        if (curr.getDay() === 0) {
          curr.setDate(curr.getDate() + 1);
        }
      }
      row.patchValue({ testDate: this.formatDateToYMD(curr) });
    });
  }

  populateFromClassCurriculum(): void {
    const examType = this.scheduleForm.get('examType')?.value || 'Annual Exam';
    const formMaxMarks = this.scheduleForm.get('defaultMaxMarks')?.value || 100;
    const formPassMarks = this.scheduleForm.get('defaultPassingMarks')?.value || 33;

    this.examRows.clear();

    if (this.currentClassSubjects.length > 0) {
      this.currentClassSubjects.forEach(cs => {
        this.examRows.push(this.fb.group({
          subject: [cs.subjectName, Validators.required],
          title: [`${examType} - ${cs.subjectName}`, Validators.required],
          testDate: ['', Validators.required],
          maxMarks: [cs.totalMarks || formMaxMarks, [Validators.required, Validators.min(1)]],
          passingMarks: [cs.passingMarks || formPassMarks, [Validators.required, Validators.min(1)]]
        }));
      });
    } else {
      const fallbackList = this.allSubjects.length > 0
        ? this.allSubjects.slice(0, 6).map(s => s.name)
        : ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'];

      fallbackList.forEach(sub => {
        this.examRows.push(this.fb.group({
          subject: [sub, Validators.required],
          title: [`${examType} - ${sub}`, Validators.required],
          testDate: ['', Validators.required],
          maxMarks: [formMaxMarks, [Validators.required, Validators.min(1)]],
          passingMarks: [formPassMarks, [Validators.required, Validators.min(1)]]
        }));
      });
    }

    // Auto-sequence dates starting from startDate and skipping Sundays!
    this.autoSequenceExamDates();
  }

  addScheduleRow(): void {
    const maxMarks = this.scheduleForm.get('defaultMaxMarks')?.value || 100;
    const passMarks = this.scheduleForm.get('defaultPassingMarks')?.value || 33;
    const examType = this.scheduleForm.get('examType')?.value || 'Annual Exam';

    let nextDate = this.getDefaultExamStartDate();
    if (this.examRows.length > 0) {
      const lastDateStr = this.examRows.at(this.examRows.length - 1).get('testDate')?.value;
      if (lastDateStr) {
        const parts = lastDateStr.split('-');
        const lastD = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        lastD.setDate(lastD.getDate() + 1);
        if (lastD.getDay() === 0) lastD.setDate(lastD.getDate() + 1); // Skip Sunday
        nextDate = this.formatDateToYMD(lastD);
      }
    }

    this.examRows.push(this.fb.group({
      subject: ['', Validators.required],
      title: [`${examType} Exam`, Validators.required],
      testDate: [nextDate, Validators.required],
      maxMarks: [maxMarks, [Validators.required, Validators.min(1)]],
      passingMarks: [passMarks, [Validators.required, Validators.min(1)]]
    }));
  }

  removeScheduleRow(index: number): void {
    this.examRows.removeAt(index);
  }

  onSubjectChange(index: number, subName: string): void {
    const examType = this.scheduleForm.get('examType')?.value || 'Annual Exam';
    const row = this.examRows.at(index);
    if (row && subName) {
      row.get('title')?.setValue(`${examType} - ${subName}`);
      const matchedCs = this.currentClassSubjects.find(cs => cs.subjectName.toLowerCase() === subName.toLowerCase());
      if (matchedCs) {
        if (matchedCs.totalMarks) row.get('maxMarks')?.setValue(matchedCs.totalMarks);
        if (matchedCs.passingMarks) row.get('passingMarks')?.setValue(matchedCs.passingMarks);
      }
    }
  }

  saveBulkSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.confirmDialog.alert('Incomplete Form', 'Please fill in all required fields for every subject exam.', 'warning');
      return;
    }

    const val = this.scheduleForm.value;
    const targetClass = this.classes.find(c => c.id === val.classId)?.name || 'Class';

    // Sunday Exam Validation Warning
    const sundayExams = (val.exams || []).filter((e: any) => this.isSunday(e.testDate));
    if (sundayExams.length > 0) {
      const sundayList = sundayExams.map((e: any) => `• ${e.subject} (${e.testDate} - Sunday)`).join('\n');
      this.confirmDialog.confirm(
        'Sunday Exam Warning ⚠️',
        `Warning: The following exam(s) fall on Sunday (Weekly Holiday):\n\n${sundayList}\n\nSchool examinations are usually not scheduled on Sundays. Are you sure you want to schedule on Sunday, or would you like to cancel and change the date?`,
        'Keep Sunday & Schedule',
        'Cancel (Change Dates)',
        'warning'
      ).subscribe(confirmed => {
        if (!confirmed) return;
        this.executeSaveBulkSchedule(val, targetClass);
      });
      return;
    }

    this.confirmDialog.confirm(
      'Confirm Exam Schedule',
      `Are you sure you want to schedule ${val.exams.length} exam(s) for "${targetClass}" under "${val.examType}" (${val.academicYear})?`,
      'Schedule Exams',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.executeSaveBulkSchedule(val, targetClass);
    });
  }

  private executeSaveBulkSchedule(val: any, targetClass: string): void {
    this.savingSchedule = true;
    const payload: CreateBulkSchoolExamsDto = {
      classId: val.classId,
      sectionId: val.sectionId || undefined,
      academicYear: val.academicYear,
      examType: val.examType,
      exams: val.exams.map((e: any) => ({
        subject: e.subject,
        title: e.title,
        testDate: new Date(e.testDate).toISOString(),
        maxMarks: Number(e.maxMarks),
        passingMarks: Number(e.passingMarks)
      }))
    };

    this.schoolService.createBulkSchoolExams(payload).subscribe({
      next: (created) => {
        this.savingSchedule = false;
        this.confirmDialog.alert('Exams Scheduled! 🎉', `Successfully scheduled ${created.length} exam(s) for ${targetClass}. Teachers can now enter marks.`, 'success');
        this.activeTabIndex = 0;
        this.filterClassId = val.classId;
        this.filterAcademicYear = val.academicYear;
        this.filterExamType = val.examType;
        this.loadExams();
      },
      error: (err) => {
        this.savingSchedule = false;
        this.confirmDialog.alert('Scheduling Failed', err?.error?.message || 'Failed to schedule exams.', 'danger');
      }
    });
  }

  // ─── Marks Entry Modal ─────────────────────────────

  openMarksEntry(exam: SchoolExamDto): void {
    if (!exam.isMarksLocked && (exam.evaluationStatus === 'Scheduled' || !exam.evaluatorTeacherId)) {
      this.confirmDialog.confirm(
        'Copy Bundle Not Handed Over ⚠️',
        `उत्तर पुस्तिकाएं (Copy Bundle) अभी शिक्षक को आवंटित नहीं की गई हैं।\n\nस्कूल नियम अनुसार, लिखित परीक्षा में पहले शिक्षक को कॉपी बंडल और कच्चा अंक पत्रक (Award Sheet) सौंपा जाता है।\n\nक्या आप अभी शिक्षक को कॉपी बंडल आवंटित करना चाहते हैं, या यह केवल मौखिक/प्रैक्टिकल परीक्षा (Oral/Practical Exam) है जिसके लिए सीधे अंक प्रविष्टि करनी है?`,
        'कॉपी बंडल आवंटित करें (Assign Bundle)',
        'मौखिक/सीधे अंक प्रविष्टि (Direct Entry)',
        'info'
      ).subscribe(assignNow => {
        if (assignNow) {
          this.openEvaluationModal(exam);
        } else {
          this.proceedToMarksEntry(exam);
        }
      });
      return;
    }

    if (!exam.isMarksLocked && exam.evaluationStatus === 'CopiesUnderEvaluation') {
      const teacherName = exam.evaluatorTeacherName ? `"${exam.evaluatorTeacherName}"` : 'the assigned evaluator teacher';
      
      const title = this.isTeacher ? 'Evaluation Confirmation 📋' : 'Copies Under Evaluation 📋';
      const message = this.isTeacher
        ? `Have you completed physical evaluation of all answer sheets for "${exam.title}" (${exam.subject}) and are ready to enter marks into the ERP?`
        : `Answer sheets for "${exam.title}" (${exam.subject}) are currently checked out to ${teacherName} for physical evaluation.\n\nHave all evaluated copies been checked and received back in the office?`;
      const confirmBtn = this.isTeacher ? 'Yes, Checking Completed & Enter Marks' : 'Yes, Copies Received & Enter Marks';
      const cancelBtn = this.isTeacher ? 'Still Checking Copies' : 'Wait for Teacher Submission';

      this.confirmDialog.confirm(
        title,
        message,
        confirmBtn,
        cancelBtn,
        'warning'
      ).subscribe(confirmed => {
        if (!confirmed) return;

        // Auto-mark evaluation completed upon verified receipt
        const workflowPayload: UpdateExamEvaluationWorkflowDto = {
          examId: exam.id,
          evaluatorTeacherId: exam.evaluatorTeacherId,
          evaluationStatus: 'EvaluationCompleted',
          copiesSubmittedDate: new Date().toISOString()
        };
        this.schoolService.updateExamEvaluationWorkflow(workflowPayload).subscribe({
          next: () => {
            exam.evaluationStatus = 'EvaluationCompleted';
            this.proceedToMarksEntry(exam);
          },
          error: () => {
            this.proceedToMarksEntry(exam);
          }
        });
      });
      return;
    }

    this.proceedToMarksEntry(exam);
  }

  private proceedToMarksEntry(exam: SchoolExamDto): void {
    this.activeExamForMarks = exam;
    this.loadingMarks = true;
    this.marksList = [];
    this.marksFilterText = '';

    this.schoolService.getSchoolExamMarks(exam.id).subscribe({
      next: (marks) => {
        this.loadingMarks = false;
        this.marksList = marks;
      },
      error: (err) => {
        this.loadingMarks = false;
        this.confirmDialog.alert('Failed to Load Marks', err?.error?.message || 'Could not load student list for this exam.', 'danger');
      }
    });
  }

  closeMarksEntry(): void {
    this.activeExamForMarks = null;
    this.marksList = [];
  }

  get filteredMarksList(): SchoolExamMarksItemDto[] {
    if (!this.marksFilterText.trim()) return this.marksList;
    const term = this.marksFilterText.toLowerCase().trim();
    return this.marksList.filter(m =>
      m.studentName.toLowerCase().includes(term) ||
      m.admissionNumber.toLowerCase().includes(term) ||
      (m.schoolRollNumber && m.schoolRollNumber.toLowerCase().includes(term))
    );
  }

  onMarksChanged(item: SchoolExamMarksItemDto): void {
    if (this.activeExamForMarks) {
      if (item.marksObtained > this.activeExamForMarks.maxMarks) {
        item.marksObtained = this.activeExamForMarks.maxMarks;
      }
      if (item.marksObtained < 0) {
        item.marksObtained = 0;
      }
      item.percentage = this.activeExamForMarks.maxMarks > 0 
        ? Math.round((item.marksObtained / this.activeExamForMarks.maxMarks) * 100) 
        : 0;
      item.isPassed = !item.isAbsent && item.marksObtained >= this.activeExamForMarks.passingMarks;
    }
  }

  onAbsentToggled(item: SchoolExamMarksItemDto): void {
    if (item.isAbsent) {
      item.marksObtained = 0;
      item.percentage = 0;
      item.isPassed = false;
    } else {
      this.onMarksChanged(item);
    }
  }

  saveAllMarks(): void {
    if (!this.activeExamForMarks) return;

    const currentExam = this.activeExamForMarks;
    this.savingMarks = true;
    const payload: SaveSchoolExamMarksDto = {
      examId: currentExam.id,
      marksList: this.marksList.map(m => ({
        studentId: m.studentId,
        marksObtained: Number(m.marksObtained),
        isAbsent: m.isAbsent,
        remarks: m.remarks || undefined
      }))
    };

    this.schoolService.saveSchoolExamMarks(payload).subscribe({
      next: (res) => {
        this.savingMarks = false;
        const totalCount = this.marksList.length;
        const evaluatedCount = this.marksList.filter(m => (m.marksObtained !== null && m.marksObtained !== undefined && !isNaN(Number(m.marksObtained))) || m.isAbsent).length;
        const isAllEvaluated = totalCount > 0 && evaluatedCount === totalCount;

        this.closeMarksEntry();
        this.loadExams();

        // 100% Industry Standard Rule:
        // If teacher is entering marks, inform that marks have been submitted for admin approval
        if (this.isTeacher) {
          this.confirmDialog.alert(
            'Marks Saved & Submitted! ✅',
            `Marks for all ${totalCount} student(s) have been saved successfully and submitted for Administrative approval & final locking.`,
            'success'
          );
        } else if (isAllEvaluated && !currentExam.isMarksLocked) {
          // If Admin is entering marks, prompt to Lock & Freeze now
          this.confirmDialog.confirm(
            'Marks Saved! Lock & Freeze Exam? 🔒',
            `Marks for all ${totalCount} student(s) have been successfully saved.\n\nWould you like to Lock & Freeze this exam now to preserve evaluation audit integrity and prevent further alterations?`,
            'Lock & Freeze Now 🔒',
            'Keep Editable for Now',
            'success'
          ).subscribe(lockNow => {
            if (lockNow) {
              this.executeLockExam(currentExam, true);
            }
          });
        } else {
          this.confirmDialog.alert('Marks Saved Successfully! ✅', res.message, 'success');
        }
      },
      error: (err) => {
        this.savingMarks = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save marks.', 'danger');
      }
    });
  }

  openClassMultiSubjectDialog(presetClassId?: string): void {
    const dialogRef = this.dialog.open(SchoolClassMarksMatrixDialogComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      maxHeight: '900px',
      disableClose: true,
      data: {
        classId: presetClassId || this.filterClassId || (this.classes.length > 0 ? this.classes[0].id : ''),
        sectionId: this.filterSectionId || '',
        academicYear: this.filterAcademicYear || '2025-2026',
        examType: this.filterExamType || 'Annual Exam',
        classes: this.classes
      } as SchoolClassMarksMatrixDialogData
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res?.saved) {
        this.loadExams();
        if (this.consolidatedResult) {
          this.loadConsolidatedResults();
        }
      }
    });
  }

  deleteExam(exam: SchoolExamDto): void {
    this.confirmDialog.danger(
      'Delete Exam',
      `Are you sure you want to delete "${exam.title}" (${exam.className}) and all associated student marks?`
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.schoolService.deleteSchoolExam(exam.id).subscribe({
        next: (res) => {
          this.confirmDialog.alert('Deleted', res.message, 'success');
          this.loadExams();
        },
        error: (err) => {
          this.confirmDialog.alert('Delete Failed', err?.error?.message || 'Failed to delete exam.', 'danger');
        }
      });
    });
  }

  // ─── Evaluation Workflow Tracking ──────────────────

  isSubjectMatch(teacher: any): boolean {
    if (!this.selectedExamForEvaluation?.subject || !teacher?.specialization) return false;
    const examSub = this.selectedExamForEvaluation.subject.toLowerCase().trim();
    const teacherSub = teacher.specialization.toLowerCase().trim();
    return teacherSub.includes(examSub) || examSub.includes(teacherSub);
  }

  getSelectedTeacher(): any | null {
    if (!this.evaluatorTeacherId) return null;
    return this.teachers.find(t => t.id === this.evaluatorTeacherId) || null;
  }

  get filteredTeachers(): any[] {
    let list = this.teachers || [];
    if (this.teacherSearchTerm && this.teacherSearchTerm.trim()) {
      const term = this.teacherSearchTerm.toLowerCase().trim();
      list = list.filter(t => {
        const name = (t.fullName || t.name || '').toLowerCase();
        const subject = (t.specialization || t.department || '').toLowerCase();
        const phone = (t.phone || t.phoneNumber || '').toLowerCase();
        const code = (t.employeeCode || '').toLowerCase();
        return name.includes(term) || subject.includes(term) || phone.includes(term) || code.includes(term);
      });
    }

    if (this.selectedExamForEvaluation?.subject) {
      return [...list].sort((a, b) => {
        const matchA = this.isSubjectMatch(a) ? 1 : 0;
        const matchB = this.isSubjectMatch(b) ? 1 : 0;
        if (matchB !== matchA) return matchB - matchA;
        return (a.fullName || a.name || '').localeCompare(b.fullName || b.name || '');
      });
    }

    return list;
  }

  get minExamDate(): string {
    if (!this.selectedExamForEvaluation?.testDate) return '';
    return this.selectedExamForEvaluation.testDate.substring(0, 10);
  }

  get todayIsoDate(): string {
    return new Date().toISOString().substring(0, 10);
  }

  get isDueDateInvalid(): boolean {
    if (!this.evaluationDueDate || !this.minExamDate) return false;
    return this.evaluationDueDate < this.minExamDate;
  }

  get isReturnDateInvalid(): boolean {
    if (!this.copiesSubmittedDate) return false;
    if (this.minExamDate && this.copiesSubmittedDate < this.minExamDate) return true;
    if (this.copiesSubmittedDate > this.todayIsoDate) return true;
    return false;
  }

  get returnDateErrorMsg(): string {
    if (!this.copiesSubmittedDate) return '';
    if (this.minExamDate && this.copiesSubmittedDate < this.minExamDate) {
      return `Cannot be earlier than exam date (${this.minExamDate})`;
    }
    if (this.copiesSubmittedDate > this.todayIsoDate) {
      return `Cannot be in the future (today: ${this.todayIsoDate})`;
    }
    return '';
  }

  openEvaluationModal(exam: SchoolExamDto): void {
    this.selectedExamForEvaluation = exam;
    this.teacherSearchTerm = '';
    this.evaluatorTeacherId = exam.evaluatorTeacherId || '';
    this.evaluationStatus = exam.evaluationStatus || 'Scheduled';
    this.evaluationDueDate = exam.evaluationDueDate ? exam.evaluationDueDate.substring(0, 10) : '';
    this.totalCopiesIssued = exam.totalCopiesIssued !== null && exam.totalCopiesIssued !== undefined ? exam.totalCopiesIssued : exam.totalStudents;
    this.copiesSubmittedDate = exam.copiesSubmittedDate ? exam.copiesSubmittedDate.substring(0, 10) : '';
    this.evaluationRemarks = exam.evaluationRemarks || '';
    this.showEvaluationModal = true;
  }

  closeEvaluationModal(): void {
    this.showEvaluationModal = false;
    this.selectedExamForEvaluation = null;
    this.savingEvaluationWorkflow = false;
  }

  saveEvaluationWorkflow(): void {
    if (!this.selectedExamForEvaluation) return;

    if (this.isDueDateInvalid) {
      this.confirmDialog.alert(
        'Invalid Due Date ⚠️',
        `Evaluation Due Date cannot be earlier than the Exam Date (${this.minExamDate}).`,
        'warning'
      );
      return;
    }

    if (this.isReturnDateInvalid) {
      this.confirmDialog.alert(
        'Invalid Return Date ⚠️',
        this.returnDateErrorMsg || 'Please provide a valid Submission Date within the permitted range.',
        'warning'
      );
      return;
    }

    this.savingEvaluationWorkflow = true;
    const payload: UpdateExamEvaluationWorkflowDto = {
      examId: this.selectedExamForEvaluation.id,
      evaluatorTeacherId: this.evaluatorTeacherId || undefined,
      evaluationStatus: this.evaluationStatus || 'Scheduled',
      evaluationDueDate: this.evaluationDueDate ? new Date(this.evaluationDueDate).toISOString() : undefined,
      totalCopiesIssued: this.totalCopiesIssued !== null ? Number(this.totalCopiesIssued) : undefined,
      copiesSubmittedDate: this.copiesSubmittedDate ? new Date(this.copiesSubmittedDate).toISOString() : undefined,
      evaluationRemarks: this.evaluationRemarks ? this.evaluationRemarks.trim() : undefined
    };

    this.schoolService.updateExamEvaluationWorkflow(payload).subscribe({
      next: (res) => {
        this.savingEvaluationWorkflow = false;
        this.confirmDialog.alert('Evaluation Tracking Updated! 📋', res.message, 'success');
        this.closeEvaluationModal();
        this.loadExams();
      },
      error: (err) => {
        this.savingEvaluationWorkflow = false;
        this.confirmDialog.alert('Update Failed', err?.error?.message || 'Could not update evaluation tracking.', 'danger');
      }
    });
  }

  // ─── Marks Freezing / Locking ─────────────────────

  executeLockExam(exam: SchoolExamDto, lockState: boolean): void {
    this.lockingExamId = exam.id;
    const payload: LockExamMarksDto = {
      examId: exam.id,
      lockState
    };

    this.schoolService.lockExamMarks(payload).subscribe({
      next: (res) => {
        this.lockingExamId = null;
        exam.isMarksLocked = res.isLocked;
        this.confirmDialog.alert(
          res.isLocked ? 'Marks Locked & Frozen! 🔒' : 'Marks Unlocked! 🔓',
          res.message,
          'success'
        );
        this.loadExams();
      },
      error: (err) => {
        this.lockingExamId = null;
        this.confirmDialog.alert('Operation Failed', err?.error?.message || 'Failed to update marks lock state.', 'danger');
      }
    });
  }

  toggleLockMarks(exam: SchoolExamDto): void {
    const isCurrentlyLocked = !!exam.isMarksLocked;
    const actionText = isCurrentlyLocked ? 'Unlock' : 'Lock & Freeze';
    const message = isCurrentlyLocked
      ? `Are you sure you want to unlock marks for "${exam.title}" (${exam.className})? This will allow teachers and staff to modify scores.`
      : `Are you sure you want to lock and freeze marks for "${exam.title}" (${exam.className})? Once locked, marks cannot be altered without unlocking by the Exam Controller / Principal.`;

    this.confirmDialog.confirm(
      `${actionText} Marks`,
      message,
      isCurrentlyLocked ? 'Unlock Now' : 'Lock & Freeze',
      'Cancel',
      isCurrentlyLocked ? 'info' : 'warning'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.executeLockExam(exam, !isCurrentlyLocked);
    });
  }

  // ─── Blank Award Sheet (कच्चा अंक पत्रक) ──────────────

  openBlankAwardSheet(exam: SchoolExamDto): void {
    this.showAwardSheetModal = true;
    this.loadingAwardSheet = true;
    this.awardSheetData = null;

    this.schoolService.getBlankAwardSheet(exam.id).subscribe({
      next: (sheet) => {
        this.loadingAwardSheet = false;
        this.awardSheetData = sheet;
      },
      error: (err) => {
        this.loadingAwardSheet = false;
        this.showAwardSheetModal = false;
        this.confirmDialog.alert('Failed to Load Award Sheet', err?.error?.message || 'Could not generate award sheet.', 'danger');
      }
    });
  }

  closeAwardSheetModal(): void {
    document.body.classList.remove('printing-award-sheet');
    this.showAwardSheetModal = false;
    this.awardSheetData = null;
  }

  printAwardSheet(): void {
    document.body.classList.add('printing-award-sheet');
    const cleanup = () => {
      document.body.classList.remove('printing-award-sheet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2000);
    }, 50);
  }

  // ─── Consolidated Results & Dynamic Benchmarks (Tab 3) ──

  loadExamSettings(): void {
    this.schoolService.getExamSettings().subscribe({
      next: (settings) => {
        this.examSettings = settings;
        this.settingPassingPercentage = settings.passingPercentage || 33;
        this.settingMaxCompartment = settings.maxCompartmentSubjects ?? 2;
        this.settingAllowGrace = settings.allowGraceMarks ?? true;
        this.settingMaxGrace = settings.maxGraceMarks ?? 5;

        if (settings.activeAcademicYear) {
          this.filterAcademicYear = settings.activeAcademicYear;
          this.resultAcademicYear = settings.activeAcademicYear;
        }

        if (settings.availableAcademicYears) {
          const sessions = settings.availableAcademicYears.split(',').map(s => s.trim()).filter(Boolean);
          if (sessions.length > 0) {
            this.availableSessions = sessions;
          }
        }
      }
    });
  }

  saveExamSettingsAsDefault(): void {
    this.savingSettings = true;
    const payload: UpdateExamSettingDto = {
      passingPercentage: Number(this.settingPassingPercentage),
      maxCompartmentSubjects: Number(this.settingMaxCompartment),
      allowGraceMarks: this.settingAllowGrace,
      maxGraceMarks: Number(this.settingMaxGrace),
      schoolAffiliationNumber: this.examSettings?.schoolAffiliationNumber,
      principalSignTitle: this.examSettings?.principalSignTitle,
      classTeacherSignTitle: this.examSettings?.classTeacherSignTitle,
      resultDeclarationNote: this.examSettings?.resultDeclarationNote
    };

    this.schoolService.updateExamSettings(payload).subscribe({
      next: (saved) => {
        this.savingSettings = false;
        this.examSettings = saved;
        this.confirmDialog.alert('Settings Saved! ⚙️', 'School exam evaluation benchmark has been successfully updated as institute default.', 'success');
        this.loadConsolidatedResults();
      },
      error: (err) => {
        this.savingSettings = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Could not save exam settings.', 'danger');
      }
    });
  }

  loadConsolidatedResults(): void {
    if (!this.resultClassId) return;

    this.loadingResults = true;
    this.consolidatedResult = null;

    this.schoolService.getConsolidatedResults(
      this.resultClassId,
      this.resultAcademicYear,
      this.resultExamType || undefined,
      this.resultSectionId || undefined,
      this.settingPassingPercentage,
      this.settingMaxCompartment,
      this.settingAllowGrace,
      this.settingMaxGrace
    ).subscribe({
      next: (res) => {
        this.loadingResults = false;
        this.consolidatedResult = res;
        if (res.settings) {
          this.examSettings = res.settings;
        }
      },
      error: (err) => {
        this.loadingResults = false;
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Failed to load consolidated marksheet.', 'danger');
      }
    });
  }

  // Examination Cards & Document Modals (BSEB Marksheet, Admit Card, Result Card, Report Card, Certificate)
  openBsebMarksheet(student: ConsolidatedStudentResultDto): void {
    this.openDocumentDialog(student, 'single', 'bseb_marksheet');
  }

  openAdmitCard(student: ConsolidatedStudentResultDto): void {
    this.openDocumentDialog(student, 'single', 'admit_card');
  }

  openResultCard(student: ConsolidatedStudentResultDto): void {
    this.openDocumentDialog(student, 'single', 'result_card');
  }

  openReportCard(student: ConsolidatedStudentResultDto, mode: 'single' | 'certificate' = 'single'): void {
    this.openDocumentDialog(student, mode, mode === 'certificate' ? 'certificate' : 'marksheet');
  }

  openPromotionCertificate(student: ConsolidatedStudentResultDto): void {
    this.openDocumentDialog(student, 'certificate', 'certificate');
  }

  openDocumentDialog(student: ConsolidatedStudentResultDto, mode: 'single' | 'certificate', initialView: 'bseb_marksheet' | 'admit_card' | 'result_card' | 'marksheet' | 'certificate'): void {
    if (!this.consolidatedResult) return;

    this.dialog.open(SchoolReportCardDialogComponent, {
      width: '96vw',
      maxWidth: '1280px',
      height: '92vh',
      maxHeight: '94vh',
      panelClass: 'custom-dialog-container',
      data: {
        mode,
        initialView,
        className: this.consolidatedResult.className,
        academicYear: this.resultAcademicYear,
        examType: this.resultExamType,
        student,
        settings: this.examSettings || this.consolidatedResult.settings,
        subjects: this.consolidatedResult.subjects,
        exams: this.exams
      }
    });
  }

  bulkPrintBsebMarksheets(): void {
    this.bulkPrintDocuments('bseb_marksheet');
  }

  bulkPrintAdmitCards(): void {
    this.bulkPrintDocuments('admit_card');
  }

  bulkPrintResultCards(): void {
    this.bulkPrintDocuments('result_card');
  }

  bulkPrintAllReportCards(): void {
    this.bulkPrintDocuments('marksheet');
  }

  bulkPrintDocuments(view: 'bseb_marksheet' | 'admit_card' | 'result_card' | 'marksheet' | 'certificate'): void {
    if (!this.consolidatedResult || !this.consolidatedResult.students.length) {
      this.confirmDialog.alert('No Student Records', 'No evaluated student records found to print. Please evaluate marks or select a class with student records.', 'warning');
      return;
    }

    this.dialog.open(SchoolReportCardDialogComponent, {
      width: '96vw',
      maxWidth: '1280px',
      height: '92vh',
      maxHeight: '94vh',
      panelClass: 'custom-dialog-container',
      data: {
        mode: 'bulk',
        initialView: view,
        className: this.consolidatedResult.className,
        academicYear: this.resultAcademicYear,
        examType: this.resultExamType,
        allStudents: this.consolidatedResult.students,
        settings: this.examSettings || this.consolidatedResult.settings,
        subjects: this.consolidatedResult.subjects,
        exams: this.exams
      }
    });
  }

  printClassAdmitCards(): void {
    const targetClassId = this.filterClassId || (this.classes.length > 0 ? this.classes[0].id : '');
    if (!targetClassId) {
      this.confirmDialog.alert('Select Class', 'Please select a Class first to print Admit Cards.', 'info');
      return;
    }

    if (this.consolidatedResult && this.consolidatedResult.classId === targetClassId && this.consolidatedResult.students.length > 0) {
      this.bulkPrintAdmitCards();
      return;
    }

    this.resultClassId = targetClassId;
    this.resultAcademicYear = this.filterAcademicYear || '2025-2026';
    this.resultExamType = this.filterExamType || 'Annual Exam';
    this.loadingResults = true;
    this.schoolService.getConsolidatedResults(targetClassId, this.resultAcademicYear, this.resultExamType).subscribe({
      next: (res) => {
        this.loadingResults = false;
        this.consolidatedResult = res;
        this.bulkPrintAdmitCards();
      },
      error: (err) => {
        this.loadingResults = false;
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Failed to load class students for admit cards.', 'danger');
      }
    });
  }

  sendStudentWhatsApp(student: ConsolidatedStudentResultDto): void {
    const phone = student.parentWhatsAppPhone;
    if (!phone) {
      this.confirmDialog.alert('WhatsApp Number Missing', `Parent WhatsApp number is not recorded for ${student.studentName}.`, 'warning');
      return;
    }

    this.confirmDialog.confirm(
      'Send WhatsApp Result',
      `Send annual examination result summary to ${student.studentName}'s parent (${phone})?`,
      'Send WhatsApp',
      'Cancel',
      'info'
    ).subscribe((confirmed) => {
      if (!confirmed) return;

      this.schoolService.sendAnnualResultWhatsApp({
        studentId: student.studentId,
        studentName: student.studentName,
        recipientPhone: phone,
        examTitle: `${this.consolidatedResult?.className || 'Class'} ${this.resultExamType || 'Annual Exam'}`,
        academicYear: this.resultAcademicYear,
        totalObtained: student.totalObtained,
        totalMax: student.totalMax,
        percentage: student.overallPercentage,
        grade: student.grade,
        resultStatus: student.resultStatus,
        rank: student.rank > 0 ? student.rank : undefined
      }).subscribe({
        next: (res) => {
          this.confirmDialog.alert('WhatsApp Dispatched! 📱', res.message, 'success');
        },
        error: () => {
          // Fallback direct wa.me
          const msg = encodeURIComponent(
            `*ANNUAL EXAM RESULT (${this.resultAcademicYear})*\n\nDear Parent, performance report for *${student.studentName}* (Roll: ${student.rollNumber}, Class: ${this.consolidatedResult?.className}):\n• Total: *${student.totalObtained} / ${student.totalMax}* (${student.overallPercentage}%)\n• Grade: *${student.grade}* | Rank: *#${student.rank || '1'}*\n• Result: *${student.resultStatus}*\n• Determination: *${student.promotionVerdict}*`
          );
          window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
        }
      });
    });
  }

  goToPromotion(): void {
    if (!this.resultClassId) {
      this.router.navigate(['/students/promotion']);
      return;
    }
    // Navigate with query params for seamless transition
    this.router.navigate(['/students/promotion'], {
      queryParams: {
        fromClassId: this.resultClassId,
        academicYear: this.resultAcademicYear,
        passingPercentage: this.settingPassingPercentage
      }
    });
  }

  printResultSheet(): void {
    window.print();
  }
}
