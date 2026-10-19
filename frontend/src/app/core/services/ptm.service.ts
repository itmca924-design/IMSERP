import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PtmStats {
  totalSessions: number;
  upcomingSessions: number;
  totalBookings: number;
  totalAttended: number;
  attendanceRatePercentage: number;
  pendingFollowUps: number;
}

export interface PtmSession {
  id: string;
  tenantId: string;
  branchId?: string | null;
  title: string;
  academicYear?: string | null;
  meetingDate: string;
  startTime: string;
  endTime: string;
  meetingMode: string;
  venueOrLink?: string | null;
  divisionScope?: string; // 'All' | 'School' | 'Coaching'
  targetClassId?: string | null;
  targetClassName?: string | null;
  targetSection?: string | null;
  targetBatchId?: string | null;
  targetBatchName?: string | null;
  organizerName: string;
  agenda?: string | null;
  status: string;
  createdAt: string;
  bookingsCount: number;
  attendedCount: number;
}

export interface PtmBooking {
  id: string;
  tenantId: string;
  branchId?: string | null;
  ptmSessionId: string;
  sessionTitle: string;
  meetingDate: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
  className?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  slotTime?: string | null;
  parentAttended: string; // 'Pending' | 'Attended' | 'Both' | 'Father' | 'Mother' | 'Guardian' | 'Absent' | 'Cancelled'
  teacherName?: string | null;
  teacherFeedback?: string | null;
  parentFeedback?: string | null;
  actionPoints?: string | null;
  followUpRequired: boolean;
  followUpDate?: string | null;
  attendedAt?: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PtmService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/ptm`;

  getStats(branchId?: string | null): Observable<PtmStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<PtmStats>(`${this.apiUrl}/stats`, { params });
  }

  getSessions(filters?: {
    branchId?: string | null;
    status?: string | null;
    academicYear?: string | null;
    divisionScope?: string | null;
    searchTerm?: string | null;
  }): Observable<PtmSession[]> {
    let params = new HttpParams();
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.status && filters.status !== 'All') params = params.set('status', filters.status);
    if (filters?.academicYear && filters.academicYear !== 'All') params = params.set('academicYear', filters.academicYear);
    if (filters?.divisionScope && filters.divisionScope !== 'All') params = params.set('divisionScope', filters.divisionScope);
    if (filters?.searchTerm) params = params.set('searchTerm', filters.searchTerm);
    return this.http.get<PtmSession[]>(`${this.apiUrl}/sessions`, { params });
  }

  getSessionDetails(id: string): Observable<{ session: PtmSession; bookings: PtmBooking[] }> {
    return this.http.get<{ session: PtmSession; bookings: PtmBooking[] }>(`${this.apiUrl}/sessions/${id}`);
  }

  createSession(payload: any): Observable<PtmSession> {
    return this.http.post<PtmSession>(`${this.apiUrl}/sessions`, payload);
  }

  updateSession(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/sessions/${id}`, payload);
  }

  deleteSession(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sessions/${id}`);
  }

  getBookings(filters?: {
    sessionId?: string | null;
    studentId?: string | null;
    status?: string | null;
    branchId?: string | null;
    searchTerm?: string | null;
  }): Observable<PtmBooking[]> {
    let params = new HttpParams();
    if (filters?.sessionId) params = params.set('sessionId', filters.sessionId);
    if (filters?.studentId) params = params.set('studentId', filters.studentId);
    if (filters?.status && filters.status !== 'All') params = params.set('status', filters.status);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.searchTerm) params = params.set('searchTerm', filters.searchTerm);
    return this.http.get<PtmBooking[]>(`${this.apiUrl}/bookings`, { params });
  }

  createBooking(payload: any): Observable<PtmBooking> {
    return this.http.post<PtmBooking>(`${this.apiUrl}/bookings`, payload);
  }

  bulkEnroll(sessionId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/sessions/${sessionId}/bulk-enroll`, {});
  }

  updateBooking(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/bookings/${id}`, payload);
  }

  deleteBooking(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/bookings/${id}`);
  }
}
