import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
const API_BASE = 'http://localhost:5000/api';

export interface SchoolClassDto {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  branchId?: string;
  sectionCount: number;
  studentCount: number;
  sections?: SchoolSectionDto[];
}

export interface CreateSchoolClassDto {
  name: string;
  code?: string;
  displayOrder?: number;
  branchId?: string;
}

export interface UpdateSchoolClassDto {
  name: string;
  code?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SchoolSectionDto {
  id: string;
  tenantId: string;
  classId: string;
  className?: string;
  name: string;
  maxCapacity: number;
  roomId?: string;
  roomNumber?: string;
  isActive: boolean;
  createdAt: string;
  branchId?: string;
  studentCount: number;
}

export interface CreateSchoolSectionDto {
  classId: string;
  name: string;
  maxCapacity?: number;
  roomId?: string;
  branchId?: string;
}

export interface UpdateSchoolSectionDto {
  name: string;
  maxCapacity: number;
  roomId?: string;
  isActive: boolean;
}

export interface EnrollSchoolStudentInCoachingDto {
  studentId: string;
  batchId: string;
  coachingRollNumber?: string;
  customMonthlyFee?: number;
}

export interface UnifiedStatsDto {
  totalSchoolStudents: number;
  totalCoachingStudents: number;
  dualEnrolledStudents: number;
  totalClasses: number;
  totalBatches: number;
}

export interface PromotionCandidateDto {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  currentRollNumber: string;
  schoolRollNumber?: string;
  coachingRollNumber?: string;
  currentClassId: string;
  currentClassName: string;
  currentSectionId?: string;
  currentSectionName?: string;
  parentName?: string;
  parentWhatsAppPhone?: string;
  gender?: string;
  profilePhoto?: string;
  pendingDues: number;
  attendancePercentage: number;
  isCoachingStudent: boolean;
  coachingBatchId?: string;
  coachingBatchName?: string;
  examMarksObtained?: number;
  examMaxMarks?: number;
  examPercentage?: number;
  examResultStatus?: 'Passed' | 'Failed' | 'Absent' | 'No Exam Record';
  examGrade?: string;
  suggestedStatus?: 'Promoted' | 'Detained';
}

export interface ClassExamDto {
  id: string;
  title: string;
  subject: string;
  examType: string;
  academicYear?: string;
  maxMarks: number;
  passingMarks: number;
  testDate: string;
  evaluatedCount: number;
}

export interface StudentPromotionItemDto {
  studentId: string;
  resultStatus: 'Promoted' | 'Detained' | 'Passed with Grace' | 'Double Promoted';
  newRollNumber?: string;
  remarks?: string;
  examPercentage?: number;
  examTotalMarks?: string;
  examGrade?: string;
  examResultStatus?: string;
}

export interface ExecutePromotionRequestDto {
  fromClassId: string;
  fromSectionId?: string;
  fromAcademicYear: string;
  toClassId: string;
  toSectionId?: string;
  toAcademicYear: string;
  promotions: StudentPromotionItemDto[];
}

export interface PromotionExecutionResultDto {
  totalProcessed: number;
  promotedCount: number;
  detainedCount: number;
  message: string;
  promotedStudentIds: string[];
}

export interface StudentPromotionHistoryDto {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  fromClassId: string;
  fromClassName: string;
  fromSectionId?: string;
  fromSectionName?: string;
  fromRollNumber?: string;
  fromAcademicYear: string;
  toClassId: string;
  toClassName: string;
  toSectionId?: string;
  toSectionName?: string;
  toRollNumber?: string;
  toAcademicYear: string;
  resultStatus: string;
  promotionDate: string;
  promotedBy?: string;
  remarks?: string;
  examPercentage?: number;
  examTotalMarks?: string;
  examGrade?: string;
}

// ─── School Examination & Marks Entry Interfaces ───────────

export interface SchoolExamDto {
  id: string;
  title: string;
  subject: string;
  examType: string;
  academicYear: string;
  classId: string;
  className: string;
  sectionId?: string;
  sectionName?: string;
  maxMarks: number;
  passingMarks: number;
  testDate: string;
  totalStudents: number;
  evaluatedStudents: number;
}

export interface CreateSchoolExamItemDto {
  subject: string;
  title: string;
  testDate: string;
  maxMarks: number;
  passingMarks: number;
}

export interface CreateBulkSchoolExamsDto {
  classId: string;
  sectionId?: string;
  academicYear: string;
  examType: string;
  exams: CreateSchoolExamItemDto[];
}

export interface SchoolExamMarksItemDto {
  studentId: string;
  studentName: string;
  rollNumber?: string;
  schoolRollNumber?: string;
  admissionNumber: string;
  gender?: string;
  marksObtained: number;
  isAbsent: boolean;
  remarks?: string;
  percentage: number;
  isPassed: boolean;
}

export interface SaveSchoolExamMarkItemDto {
  studentId: string;
  marksObtained: number;
  isAbsent: boolean;
  remarks?: string;
}

export interface SaveSchoolExamMarksDto {
  examId: string;
  marksList: SaveSchoolExamMarkItemDto[];
}

export interface ConsolidatedStudentResultDto {
  studentId: string;
  studentName: string;
  rollNumber: string;
  schoolRollNumber?: string;
  admissionNumber: string;
  sectionName?: string;
  subjectMarks: { [subject: string]: number | null };
  totalObtained: number;
  totalMax: number;
  overallPercentage: number;
  grade: string;
  resultStatus: string;
}

export interface ConsolidatedClassResultDto {
  classId: string;
  className: string;
  academicYear: string;
  examType: string;
  subjects: string[];
  passingPercentage: number;
  totalStudents: number;
  passedCount: number;
  failedCount: number;
  students: ConsolidatedStudentResultDto[];
}

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private apiUrl = `${API_BASE}/school`;

  constructor(private http: HttpClient) {}

  getClasses(activeOnly: boolean = false): Observable<SchoolClassDto[]> {
    return this.http.get<SchoolClassDto[]>(`${this.apiUrl}/classes`, {
      params: { activeOnly }
    });
  }

  getClassById(id: string): Observable<SchoolClassDto> {
    return this.http.get<SchoolClassDto>(`${this.apiUrl}/classes/${id}`);
  }

  createClass(dto: CreateSchoolClassDto): Observable<SchoolClassDto> {
    return this.http.post<SchoolClassDto>(`${this.apiUrl}/classes`, dto);
  }

  updateClass(id: string, dto: UpdateSchoolClassDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/classes/${id}`, dto);
  }

  deleteClass(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/classes/${id}`);
  }

  getSections(classId?: string): Observable<SchoolSectionDto[]> {
    const params: any = {};
    if (classId) params.classId = classId;
    return this.http.get<SchoolSectionDto[]>(`${this.apiUrl}/sections`, { params });
  }

  createSection(dto: CreateSchoolSectionDto): Observable<SchoolSectionDto> {
    return this.http.post<SchoolSectionDto>(`${this.apiUrl}/sections`, dto);
  }

  updateSection(id: string, dto: UpdateSchoolSectionDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/sections/${id}`, dto);
  }

  deleteSection(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sections/${id}`);
  }

  searchSchoolStudents(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/students/search`, {
      params: { query }
    });
  }

  enrollInCoaching(dto: EnrollSchoolStudentInCoachingDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/students/enroll-coaching`, dto);
  }

  enrollSchoolStudentInCoaching(dto: EnrollSchoolStudentInCoachingDto): Observable<any> {
    return this.enrollInCoaching(dto);
  }

  getUnifiedStats(): Observable<UnifiedStatsDto> {
    return this.http.get<UnifiedStatsDto>(`${this.apiUrl}/stats`);
  }

  // ─── Student Promotion & Class Upgrade ───────────────────

  getClassExams(classId: string, academicYear?: string): Observable<ClassExamDto[]> {
    const params: any = { classId };
    if (academicYear) params.academicYear = academicYear;
    return this.http.get<ClassExamDto[]>(`${this.apiUrl}/promotions/class-exams`, { params });
  }

  getPromotionCandidates(
    fromClassId: string,
    fromSectionId?: string,
    academicYear?: string,
    examId?: string,
    passingPercentage?: number
  ): Observable<PromotionCandidateDto[]> {
    const params: any = { fromClassId };
    if (fromSectionId) params.fromSectionId = fromSectionId;
    if (academicYear) params.academicYear = academicYear;
    if (examId) params.examId = examId;
    if (passingPercentage !== undefined && passingPercentage !== null) params.passingPercentage = passingPercentage;
    return this.http.get<PromotionCandidateDto[]>(`${this.apiUrl}/promotions/candidates`, { params });
  }

  executePromotion(dto: ExecutePromotionRequestDto): Observable<PromotionExecutionResultDto> {
    return this.http.post<PromotionExecutionResultDto>(`${this.apiUrl}/promotions/execute`, dto);
  }

  getPromotionHistory(classId?: string, academicYear?: string, page = 1, pageSize = 20): Observable<{ totalCount: number; page: number; pageSize: number; items: StudentPromotionHistoryDto[] }> {
    const params: any = { page, pageSize };
    if (classId) params.classId = classId;
    if (academicYear) params.academicYear = academicYear;
    return this.http.get<{ totalCount: number; page: number; pageSize: number; items: StudentPromotionHistoryDto[] }>(`${this.apiUrl}/promotions/history`, { params });
  }

  revertPromotion(historyIds: string[]): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/promotions/revert`, historyIds);
  }

  // ─── School Examinations & Marks Entry ───────────────────

  getSchoolExams(params: {
    classId?: string;
    sectionId?: string;
    academicYear?: string;
    examType?: string;
    searchTerm?: string;
    page?: number;
    pageSize?: number;
  }): Observable<{ totalCount: number; page: number; pageSize: number; items: SchoolExamDto[] }> {
    const httpParams: any = {};
    if (params.classId) httpParams.classId = params.classId;
    if (params.sectionId) httpParams.sectionId = params.sectionId;
    if (params.academicYear) httpParams.academicYear = params.academicYear;
    if (params.examType) httpParams.examType = params.examType;
    if (params.searchTerm) httpParams.searchTerm = params.searchTerm;
    httpParams.page = params.page || 1;
    httpParams.pageSize = params.pageSize || 20;

    return this.http.get<{ totalCount: number; page: number; pageSize: number; items: SchoolExamDto[] }>(
      `${this.apiUrl}/exams`,
      { params: httpParams }
    );
  }

  createBulkSchoolExams(dto: CreateBulkSchoolExamsDto): Observable<SchoolExamDto[]> {
    return this.http.post<SchoolExamDto[]>(`${this.apiUrl}/exams/bulk`, dto);
  }

  getSchoolExamMarks(examId: string): Observable<SchoolExamMarksItemDto[]> {
    return this.http.get<SchoolExamMarksItemDto[]>(`${this.apiUrl}/exams/${examId}/marks`);
  }

  saveSchoolExamMarks(dto: SaveSchoolExamMarksDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/exams/bulk-marks`, dto);
  }

  getConsolidatedResults(
    classId: string,
    academicYear: string,
    examType?: string,
    sectionId?: string,
    passingPercentage?: number
  ): Observable<ConsolidatedClassResultDto> {
    const params: any = { classId, academicYear };
    if (examType) params.examType = examType;
    if (sectionId) params.sectionId = sectionId;
    if (passingPercentage !== undefined && passingPercentage !== null) params.passingPercentage = passingPercentage;

    return this.http.get<ConsolidatedClassResultDto>(`${this.apiUrl}/exams/consolidated-results`, { params });
  }

  deleteSchoolExam(examId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/exams/${examId}`);
  }
}
