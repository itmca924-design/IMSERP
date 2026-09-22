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

  getStudents(batchId?: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/students`, { params: batchId ? { batchId } : {} });
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
}
