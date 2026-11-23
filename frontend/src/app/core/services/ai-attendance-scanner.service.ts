import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AiAttendanceRosterItem {
  studentId: string;
  studentName: string;
  rollNumber: string;
  schoolRollNumber?: string;
  coachingRollNumber?: string;
  admissionNumber?: string;
  profilePhoto?: string;
  parentName?: string;
  parentWhatsAppPhone?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  isSchoolStudent: boolean;
  isCoachingStudent: boolean;
  attendanceStatus: 'Present' | 'Absent' | 'Late' | 'HalfDay' | 'Unmarked';
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
  captureSource?: string;
  punchDate?: string;
}

export interface AiAttendanceSummary {
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  unmarkedCount: number;
  attendancePercentage: number;
  recentPunches: AiAttendanceRosterItem[];
}

export interface AiAttendanceRosterResponse {
  date: string;
  summary: AiAttendanceSummary;
  roster: AiAttendanceRosterItem[];
}

export interface PunchResponse {
  success: boolean;
  message: string;
  punch: AiAttendanceRosterItem;
  whatsAppStatus?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiAttendanceScannerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/ai-attendance`;

  getRoster(filter: {
    branchId?: string;
    divisionScope?: string;
    classId?: string;
    sectionId?: string;
    batchId?: string;
    date?: string;
    search?: string;
  }): Observable<AiAttendanceRosterResponse> {
    let params = new HttpParams();
    if (filter.branchId) params = params.set('branchId', filter.branchId);
    if (filter.divisionScope) params = params.set('divisionScope', filter.divisionScope);
    if (filter.classId) params = params.set('classId', filter.classId);
    if (filter.sectionId) params = params.set('sectionId', filter.sectionId);
    if (filter.batchId) params = params.set('batchId', filter.batchId);
    if (filter.date) params = params.set('date', filter.date);
    if (filter.search) params = params.set('search', filter.search);

    return this.http.get<AiAttendanceRosterResponse>(`${this.apiUrl}/roster`, { params });
  }

  punchAttendance(payload: {
    studentId: string;
    attendanceDate?: string;
    status: string;
    checkInTime?: string;
    remarks?: string;
    sendWhatsAppAlert?: boolean;
  }): Observable<PunchResponse> {
    return this.http.post<PunchResponse>(`${this.apiUrl}/punch`, payload);
  }

  bulkPunch(payload: {
    studentIds: string[];
    attendanceDate?: string;
    status: string;
    remarks?: string;
    sendWhatsAppAlert?: boolean;
  }): Observable<{ success: boolean; message: string; count: number }> {
    return this.http.post<{ success: boolean; message: string; count: number }>(`${this.apiUrl}/bulk-punch`, payload);
  }

  captureStudentPhoto(studentId: string, photoBase64: string): Observable<{ success: boolean; message: string; photoUrl: string }> {
    return this.http.post<{ success: boolean; message: string; photoUrl: string }>(`${this.apiUrl}/capture-photo`, {
      studentId,
      photoBase64
    });
  }
}
