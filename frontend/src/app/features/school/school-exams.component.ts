import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
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
import {
  SchoolService,
  SchoolClassDto,
  SchoolSectionDto,
  SchoolExamDto,
  CreateBulkSchoolExamsDto,
  SchoolExamMarksItemDto,
  SaveSchoolExamMarksDto,
  ConsolidatedClassResultDto
} from '../../core/services/school.service';
import { SubjectsService, SubjectDto } from '../../core/services/subjects.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

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
    MatDividerModule
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

  // Marks Entry Overlay
  activeExamForMarks: SchoolExamDto | null = null;
  marksList: SchoolExamMarksItemDto[] = [];
  marksFilterText = '';
  loadingMarks = false;
  savingMarks = false;

  constructor(
    private schoolService: SchoolService,
    private subjectsService: SubjectsService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.scheduleForm = this.fb.group({
      classId: ['', Validators.required],
      sectionId: [''],
      academicYear: ['2025-2026', Validators.required],
      examType: ['Annual Exam', Validators.required],
      defaultMaxMarks: [100, [Validators.required, Validators.min(1)]],
      defaultPassingMarks: [33, [Validators.required, Validators.min(1)]],
      exams: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.initAcademicYears();
    this.loadClasses();
    this.loadSubjects();
    this.loadExams();
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
          if (!this.filterClassId) this.filterClassId = this.classes[0].id;
          if (!this.resultClassId) this.resultClassId = this.classes[0].id;
          if (!this.scheduleForm.get('classId')?.value) {
            this.scheduleForm.get('classId')?.setValue(this.classes[0].id);
            this.onScheduleClassChange(this.classes[0].id);
          }
        }
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
      classId: this.filterClassId || undefined,
      sectionId: this.filterSectionId || undefined,
      academicYear: this.filterAcademicYear || undefined,
      examType: this.filterExamType || undefined,
      searchTerm: this.searchTerm || undefined,
      pageSize: 50
    }).subscribe({
      next: (res) => {
        this.loadingExams = false;
        this.exams = res.items;
      },
      error: () => {
        this.loadingExams = false;
      }
    });
  }

  // ─── Scheduler Tab ─────────────────────────────────

  onScheduleClassChange(classId: string): void {
    if (!classId) return;
    this.schoolService.getSections(classId).subscribe({
      next: (secs) => { this.sections = secs; }
    });

    // If rows are empty, prefill standard school subjects
    if (this.examRows.length === 0) {
      const defaultSubjects = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'];
      const examType = this.scheduleForm.get('examType')?.value || 'Annual Exam';
      const maxMarks = this.scheduleForm.get('defaultMaxMarks')?.value || 100;
      const passMarks = this.scheduleForm.get('defaultPassingMarks')?.value || 33;
      const today = new Date().toISOString().substring(0, 10);

      defaultSubjects.forEach(sub => {
        this.examRows.push(this.fb.group({
          subject: [sub, Validators.required],
          title: [`${examType} - ${sub}`, Validators.required],
          testDate: [today, Validators.required],
          maxMarks: [maxMarks, [Validators.required, Validators.min(1)]],
          passingMarks: [passMarks, [Validators.required, Validators.min(1)]]
        }));
      });
    }
  }

  addScheduleRow(): void {
    const maxMarks = this.scheduleForm.get('defaultMaxMarks')?.value || 100;
    const passMarks = this.scheduleForm.get('defaultPassingMarks')?.value || 33;
    const examType = this.scheduleForm.get('examType')?.value || 'Annual Exam';
    const today = new Date().toISOString().substring(0, 10);

    this.examRows.push(this.fb.group({
      subject: ['', Validators.required],
      title: [`${examType} Exam`, Validators.required],
      testDate: [today, Validators.required],
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
    }
  }

  saveBulkSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.confirmDialog.alert('Incomplete Form', 'Please fill in all required fields for every subject exam.', 'warning');
      return;
    }

    const val = this.scheduleForm.value;
    const targetClass = this.classes.find(c => c.id === val.classId)?.name || 'Class';

    this.confirmDialog.confirm(
      'Confirm Exam Schedule',
      `Are you sure you want to schedule ${val.exams.length} exam(s) for "${targetClass}" under "${val.examType}" (${val.academicYear})?`,
      'Schedule Exams',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;

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
    });
  }

  // ─── Marks Entry Modal ─────────────────────────────

  openMarksEntry(exam: SchoolExamDto): void {
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

    this.savingMarks = true;
    const payload: SaveSchoolExamMarksDto = {
      examId: this.activeExamForMarks.id,
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
        this.confirmDialog.alert('Marks Saved Successfully! ✅', res.message, 'success');
        this.closeMarksEntry();
        this.loadExams();
      },
      error: (err) => {
        this.savingMarks = false;
        this.confirmDialog.alert('Save Failed', err?.error?.message || 'Failed to save marks.', 'danger');
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

  // ─── Consolidated Results (Tab 3) ─────────────────

  loadConsolidatedResults(): void {
    if (!this.resultClassId) return;

    this.loadingResults = true;
    this.consolidatedResult = null;

    this.schoolService.getConsolidatedResults(
      this.resultClassId,
      this.resultAcademicYear,
      this.resultExamType || undefined,
      this.resultSectionId || undefined
    ).subscribe({
      next: (res) => {
        this.loadingResults = false;
        this.consolidatedResult = res;
      },
      error: (err) => {
        this.loadingResults = false;
        this.confirmDialog.alert('Load Failed', err?.error?.message || 'Failed to load consolidated marksheet.', 'danger');
      }
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
        academicYear: this.resultAcademicYear
      }
    });
  }

  printResultSheet(): void {
    window.print();
  }
}
