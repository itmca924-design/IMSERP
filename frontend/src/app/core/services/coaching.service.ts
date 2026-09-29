import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StudentAdmitCardItemDto {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentName: string;
  parentWhatsAppPhone: string;
  photoUrl?: string;
  outstandingDue: number;
  isFeeCleared: boolean;
  examRollNumber: string;
  centerName: string;
  reportingTime: string;
  examDuration: string;
}

export interface ExamAdmitCardDto {
  testId: string;
  examTitle: string;
  subject: string;
  examDate: string;
  maxMarks: number;
  batchName: string;
  branchName: string;
  students: StudentAdmitCardItemDto[];
}

@Injectable({
  providedIn: 'root'
})
export class CoachingService {
  private readonly BASE_URL = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  getDashboardSummary(): Observable<any> {
    return this.http.get(`${this.BASE_URL}/dashboard/summary`);
  }

  getStudents(batchId?: string, classId?: string): Observable<any[]> {
    let params: any = {};
    if (batchId) params.batchId = batchId;
    if (classId) params.classId = classId;
    return this.http.get<any[]>(`${this.BASE_URL}/students`, { params });
  }

  getStudentsPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    sortBy: string = 'rollNumber',
    sortDescending: boolean = false,
    batchId?: string,
    stream?: string,
    classId?: string,
    sectionId?: string,
    status?: string
  ): Observable<any> {
    let params: any = {
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      sortBy,
      sortDescending: sortDescending.toString()
    };

    if (searchTerm) params.searchTerm = searchTerm;
    if (batchId) params.batchId = batchId;
    if (stream) params.stream = stream;
    if (classId) params.classId = classId;
    if (sectionId) params.sectionId = sectionId;
    if (status) params.status = status;

    return this.http.get<any>(`${this.BASE_URL}/students/paged`, { params });
  }

  getStudentClearanceStatus(id: string): Observable<any> {
    return this.http.get<any>(`${this.BASE_URL}/students/${id}/clearance-status`);
  }

  markStudentLeft(id: string, payload: {
    leavingDate: string;
    leavingReason: string;
    remarks?: string;
    vacateHostelBed: boolean;
    customTCNumber?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.BASE_URL}/students/${id}/mark-left`, payload);
  }

  reAdmitStudent(id: string, payload?: {
    reAdmissionDate?: string;
    remarks?: string;
    classId?: string;
    sectionId?: string;
    batchId?: string;
    newRollNumber?: string;
    reAdmissionFee?: number;
    resetTC?: boolean;
  }): Observable<any> {
    return this.http.post<any>(`${this.BASE_URL}/students/${id}/re-admit`, payload || {
      reAdmissionDate: new Date().toISOString(),
      remarks: 'Student re-admitted by admin'
    });
  }

  getNextRollNumber(batchId: string): Observable<{ rollNumber: string }> {
    return this.http.get<{ rollNumber: string }>(`${this.BASE_URL}/students/next-roll-number`, {
      params: { batchId }
    });
  }

  getNextAdmissionNumber(): Observable<{ admissionNumber: string }> {
    return this.http.get<{ admissionNumber: string }>(`${this.BASE_URL}/students/next-admission-number`);
  }

  getNextSchoolRollNumber(classId: string): Observable<{ schoolRollNumber: string }> {
    return this.http.get<{ schoolRollNumber: string }>(`${this.BASE_URL}/students/next-school-roll-number`, {
      params: { classId }
    });
  }

  checkPhoneDuplicate(phone: string, excludeStudentId?: string, currentStudentName?: string): Observable<{
    isFound: boolean;
    isDuplicate: boolean;
    isSibling: boolean;
    studentName: string | null;
    parentName: string | null;
    motherName?: string | null;
    address?: string | null;
    batchName: string | null;
    branchName: string | null;
  }> {
    const params: any = { phone };
    if (excludeStudentId) params.excludeStudentId = excludeStudentId;
    if (currentStudentName) params.currentStudentName = currentStudentName;
    return this.http.get<any>(
      `${this.BASE_URL}/students/check-phone`, { params }
    );
  }

  deleteStudent(id: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/students/${id}`);
  }

  createStudent(student: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/students`, student);
  }

  updateStudent(id: string, student: any): Observable<any> {
    return this.http.put(`${this.BASE_URL}/students/${id}`, student);
  }

  getBatches(): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/batches`);
  }

  getBatchAttendance(batchId: string, date?: string): Observable<any[]> {
    const params: any = {};
    if (date) params.date = date;
    return this.http.get<any[]>(`${this.BASE_URL}/students/batch/${batchId}/attendance`, { params });
  }

  saveBulkBatchAttendance(batchId: string, payload: {
    batchId: string;
    attendanceDate: string;
    sendWhatsAppAlerts: boolean;
    items: Array<{ studentId: string; status: string; remarks?: string | null }>;
  }): Observable<any> {
    return this.http.post<any>(`${this.BASE_URL}/students/batch/${batchId}/attendance/bulk`, payload);
  }

  createBatch(batch: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/batches`, batch);
  }

  getFeeInvoices(status?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/fees/invoices`, { params: status ? { status } : {} });
  }

  collectFee(payload: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/fees/collect`, payload);
  }

  sendWhatsAppReminder(invoiceId: string): Observable<any> {
    return this.http.post(`${this.BASE_URL}/fees/send-reminder/${invoiceId}`, {});
  }

  getTests(batchId?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/tests`, { params: batchId ? { batchId } : {} });
  }

  getTestsPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    batchId: string = '',
    sortBy: string = 'testDate',
    sortDescending: boolean = true
  ): Observable<any> {
    let params: any = {
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      sortBy,
      sortDescending: sortDescending.toString()
    };
    if (searchTerm) params.searchTerm = searchTerm;
    if (batchId) params.batchId = batchId;
    return this.http.get<any>(`${this.BASE_URL}/tests/paged`, { params });
  }

  createTest(test: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/tests`, test);
  }

  createBulkTests(tests: any[]): Observable<any[]> {
    return this.http.post<any[]>(`${this.BASE_URL}/tests/bulk`, tests);
  }

  getTestReportCard(testId: string): Observable<any> {
    return this.http.get(`${this.BASE_URL}/tests/${testId}/report`);
  }

  getTestMarks(testId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/tests/${testId}/marks`);
  }

  getTestAdmitCards(testId: string): Observable<ExamAdmitCardDto> {
    return this.http.get<ExamAdmitCardDto>(`${this.BASE_URL}/tests/${testId}/admit-cards`);
  }

  deleteTest(testId: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/tests/${testId}`);
  }

  saveBulkMarks(payload: any): Observable<any> {
    return this.http.post(`${this.BASE_URL}/tests/bulk-marks`, payload);
  }

  getWhatsAppLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/whatsapp/logs`);
  }

  getWhatsAppLogsPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    messageType: string = '',
    sortBy: string = 'sentAt',
    sortDescending: boolean = true
  ): Observable<any> {
    let params: any = {
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString(),
      sortBy,
      sortDescending: sortDescending.toString()
    };
    if (searchTerm) params.searchTerm = searchTerm;
    if (messageType) params.messageType = messageType;

    return this.http.get<any>(`${this.BASE_URL}/whatsapp/paged`, { params });
  }

  // ── Student 360 Profile & Documents ─────────────────────────────────────────
  getStudentProfile360(studentId: string): Observable<Student360Data> {
    return this.http.get<Student360Data>(`${this.BASE_URL}/students/${studentId}/profile-360`);
  }

  getMyStudentProfile360(): Observable<Student360Data> {
    return this.http.get<Student360Data>(`${this.BASE_URL}/students/my-profile-360`);
  }

  getStudentDocuments(studentId: string): Observable<StudentDocumentItem[]> {
    return this.http.get<StudentDocumentItem[]>(`${this.BASE_URL}/students/${studentId}/documents`);
  }

  addStudentDocument(studentId: string, payload: CreateStudentDocumentPayload): Observable<StudentDocumentItem> {
    return this.http.post<StudentDocumentItem>(`${this.BASE_URL}/students/${studentId}/documents`, payload);
  }

  deleteStudentDocument(studentId: string, docId: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/students/${studentId}/documents/${docId}`);
  }

  // ── 5 Attractive Student Features: Achievements, Discipline, PTM, Health ────
  addStudentAchievement(studentId: string, payload: CreateStudentAchievementDto): Observable<StudentAchievementDto> {
    return this.http.post<StudentAchievementDto>(`${this.BASE_URL}/students/${studentId}/achievements`, payload);
  }

  deleteStudentAchievement(studentId: string, achId: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/students/${studentId}/achievements/${achId}`);
  }

  addStudentDiscipline(studentId: string, payload: CreateStudentDisciplinaryDto): Observable<StudentDisciplinaryDto> {
    return this.http.post<StudentDisciplinaryDto>(`${this.BASE_URL}/students/${studentId}/discipline`, payload);
  }

  deleteStudentDiscipline(studentId: string, recId: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/students/${studentId}/discipline/${recId}`);
  }

  addStudentPtm(studentId: string, payload: CreateStudentPtmDto): Observable<StudentPtmDto> {
    return this.http.post<StudentPtmDto>(`${this.BASE_URL}/students/${studentId}/ptm`, payload);
  }

  deleteStudentPtm(studentId: string, ptmId: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/students/${studentId}/ptm/${ptmId}`);
  }

  saveStudentHealth(studentId: string, payload: SaveStudentHealthDto): Observable<StudentHealthDto> {
    return this.http.post<StudentHealthDto>(`${this.BASE_URL}/students/${studentId}/health`, payload);
  }
}

// ── Interfaces for Student 360 & Documents ───────────────────────────────────

export interface StudentDetail360 {
  id: string;
  studentName: string;
  rollNumber: string;
  schoolRollNumber?: string | null;
  coachingRollNumber?: string | null;
  admissionNumber?: string | null;
  isSchoolStudent: boolean;
  isCoachingStudent: boolean;
  isHostelStudent: boolean;
  isLibraryMember: boolean;
  isTransportStudent: boolean;
  classId?: string | null;
  className?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  classTeacherName?: string | null;
  classTeacherPhone?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  parentName: string;
  parentWhatsAppPhone: string;
  motherName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  bloodGroup?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  isActive: boolean;
  joiningDate: string;
  aadhaarNumber?: string | null;
  penNumber?: string | null;
  apaarId?: string | null;
  category?: string | null;
  religion?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  previousSchoolName?: string | null;
  previousBoard?: string | null;
  branchName?: string | null;
}

export interface StudentSibling360 {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className?: string | null;
  sectionName?: string | null;
  batchName?: string | null;
  profilePhoto?: string | null;
  isActive: boolean;
}

export interface StudentFeeInvoiceItem360 {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
  dueDate: string;
  createdAt: string;
}

export interface StudentFeeSummary360 {
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  totalInvoicesCount: number;
  unpaidInvoicesCount: number;
  recentInvoices: StudentFeeInvoiceItem360[];
}

export interface StudentRecentAttendanceItem360 {
  date: string;
  status: string;
  remarks?: string | null;
  captureSource?: string | null;
}

export interface StudentAttendance360 {
  totalRecordedDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  leaveDays: number;
  attendancePercentage: number;
  recentLogs: StudentRecentAttendanceItem360[];
}

export interface StudentExamMark360 {
  testId: string;
  testName: string;
  subjectName: string;
  testDate: string;
  marksObtained: number;
  maxMarks: number;
  percentage: number;
  status: string;
  remarks?: string | null;
}

export interface StudentIssuedBook360 {
  circulationId: string;
  bookTitle: string;
  accessionNumber?: string | null;
  issueDate: string;
  dueDate: string;
  isOverdue: boolean;
  fineAmount: number;
  fineStatus: string;
}

export interface StudentLibrary360 {
  isMember: boolean;
  libraryCardNumber?: string | null;
  membershipPlan?: string | null;
  maxBooksAllowed: number;
  monthlyFee: number;
  currentlyIssuedCount: number;
  issuedBooks: StudentIssuedBook360[];
}

export interface StudentFacility360 {
  hasHostel: boolean;
  hostelName?: string | null;
  roomNumber?: string | null;
  bedCode?: string | null;
  monthlyBedRent?: number | null;
  hasTransport: boolean;
  routeName?: string | null;
  stopName?: string | null;
  vehicleNumber?: string | null;
  transportMonthlyFee?: number | null;
}

export interface StudentLeave360 {
  leaveId: string;
  reason: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  status: string;
  appliedAt: string;
}

export interface StudentGatePass360 {
  passId: string;
  passNumber: string;
  reason: string;
  outTime: string;
  inTime?: string | null;
  status: string;
  guardianName?: string | null;
}

export interface StudentDocumentItem {
  id: string;
  studentId: string;
  studentName: string;
  documentType: string;
  title: string;
  documentNumber?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  verificationStatus: string;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface CreateStudentDocumentPayload {
  documentType: string;
  title: string;
  documentNumber?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileBase64?: string | null;
  remarks?: string | null;
}

export interface StudentAchievementDto {
  id: string;
  studentId: string;
  title: string;
  category: string; // Academic, Sports, Cultural, Leadership, Olympiad, Other
  level?: string | null;
  awardLevel?: string | null;
  position?: string | null;
  awardedDate?: string;
  awardDate?: string;
  issuedBy?: string | null;
  awardedBy?: string | null;
  certificateNumber?: string | null;
  remarks?: string | null;
  description?: string | null;
  badgeIcon?: string | null;
  createdAt: string;
}

export interface CreateStudentAchievementDto {
  title: string;
  category: string;
  level?: string | null;
  position?: string | null;
  awardedDate: string;
  issuedBy?: string | null;
  certificateNumber?: string | null;
  remarks?: string | null;
  badgeIcon?: string | null;
}

export interface StudentDisciplinaryDto {
  id: string;
  studentId: string;
  incidentDate: string;
  incidentType: string; // PositiveCommendation, MinorInfraction, ModerateMisconduct, SevereViolation
  severity: string; // Low, Medium, High, Critical, Commendation
  title: string;
  description: string;
  actionTaken?: string | null;
  reportedByName?: string | null;
  reportedBy?: string | null;
  parentNotified: boolean;
  parentNotifiedAt?: string | null;
  status?: string;
  isResolved?: boolean;
  createdAt: string;
}

export interface CreateStudentDisciplinaryDto {
  incidentDate: string;
  incidentType: string;
  severity: string;
  title: string;
  description: string;
  actionTaken?: string | null;
  reportedByName?: string | null;
  parentNotified: boolean;
  status: string;
}

export interface StudentPtmDto {
  id: string;
  studentId: string;
  meetingDate?: string;
  ptmDate?: string;
  attendedByParentName?: string;
  parentAttended?: string;
  teacherName?: string | null;
  discussionSummary?: string | null;
  teacherRemarks?: string | null;
  parentFeedback?: string | null;
  childStrengths?: string | null;
  areasOfImprovement?: string | null;
  actionPoints?: string | null;
  satisfactionRating?: string;
  followUpRequired?: boolean;
  createdAt: string;
}

export interface CreateStudentPtmDto {
  meetingDate: string;
  attendedByParentName: string;
  teacherName?: string | null;
  discussionSummary?: string | null;
  teacherRemarks?: string | null;
  parentFeedback?: string | null;
  actionPoints?: string | null;
  satisfactionRating: string;
}

export interface StudentHealthDto {
  id: string;
  studentId: string;
  heightCm?: number | null;
  weightKg?: number | null;
  bmi?: number | null;
  bmiCategory?: string | null;
  bloodGroup?: string | null;
  visionLeft?: string | null;
  visionRight?: string | null;
  knownAllergies?: string | null;
  chronicConditions?: string | null;
  regularMedications?: string | null;
  emergencyDoctorName?: string | null;
  emergencyDoctorPhone?: string | null;
  lastCheckupDate?: string | null;
  doctorNotes?: string | null;
  doctorRemarks?: string | null;
  updatedAt?: string;
}

export interface SaveStudentHealthDto {
  heightCm?: number | null;
  weightKg?: number | null;
  bloodGroup?: string | null;
  visionLeft?: string | null;
  visionRight?: string | null;
  knownAllergies?: string | null;
  chronicConditions?: string | null;
  regularMedications?: string | null;
  emergencyDoctorName?: string | null;
  emergencyDoctorPhone?: string | null;
  lastCheckupDate?: string | null;
  doctorNotes?: string | null;
}

export interface StudentAcademicAlert360Dto {
  hasAttendanceWarning?: boolean;
  attendanceAlertMessage?: string | null;
  hasExamWarning?: boolean;
  examAlertMessage?: string | null;
  isStarPerformer: boolean;
  performanceBadgeText?: string;
  strongSubjects: string[];
  weakSubjects: string[];
  hasAttendanceRisk?: boolean;
  hasAcademicRisk?: boolean;
  alertMessage?: string;
}

export interface Student360Data {
  student: StudentDetail360;
  siblings: StudentSibling360[];
  feeSummary: StudentFeeSummary360;
  attendanceSummary: StudentAttendance360;
  examMarks: StudentExamMark360[];
  library: StudentLibrary360;
  facilities: StudentFacility360;
  leaves: StudentLeave360[];
  gatePasses: StudentGatePass360[];
  documents: StudentDocumentItem[];
  achievements?: StudentAchievementDto[];
  disciplinaryRecords?: StudentDisciplinaryDto[];
  ptmRecords?: StudentPtmDto[];
  healthRecord?: StudentHealthDto | null;
  healthProfile?: StudentHealthDto | null;
  performanceAlert?: StudentAcademicAlert360Dto | null;
}

