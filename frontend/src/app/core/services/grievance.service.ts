import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GrievanceStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  urgentTickets: number;
  resolutionRatePercentage: number;
}

export interface GrievanceTicket {
  id: string;
  tenantId: string;
  branchId?: string | null;
  ticketNumber: string;
  divisionScope?: string; // 'All' | 'School' | 'Coaching' | 'Dual'
  studentId?: string | null;
  studentName?: string | null;
  admissionNumber?: string | null;
  className?: string | null;
  raisedByName: string;
  raisedByRole: string; // 'Parent' | 'Student' | 'Staff' | 'Visitor'
  contactPhone: string;
  contactEmail?: string | null;
  category: string; // 'Academic' | 'Fee & Billing' | 'Transport' | 'Hostel' | 'Discipline & Safety' | 'Infrastructure' | 'Staff Behavior' | 'Other'
  priority: string; // 'Low' | 'Medium' | 'High' | 'Urgent'
  subject: string;
  description: string;
  status: string; // 'Open' | 'Under Review' | 'In Progress' | 'Resolved' | 'Closed' | 'Rejected'
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  resolutionSummary?: string | null;
  resolvedAt?: string | null;
  resolvedByName?: string | null;
  createdAt: string;
  commentsCount: number;
}

export interface GrievanceComment {
  id: string;
  ticketId: string;
  branchId?: string | null;
  authorName: string;
  authorRole: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class GrievanceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/grievances`;

  getStats(branchId?: string | null): Observable<GrievanceStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<GrievanceStats>(`${this.apiUrl}/stats`, { params });
  }

  getTickets(filters?: {
    branchId?: string | null;
    status?: string | null;
    category?: string | null;
    priority?: string | null;
    divisionScope?: string | null;
    studentId?: string | null;
    searchTerm?: string | null;
  }): Observable<GrievanceTicket[]> {
    let params = new HttpParams();
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    if (filters?.status && filters.status !== 'All') params = params.set('status', filters.status);
    if (filters?.category && filters.category !== 'All') params = params.set('category', filters.category);
    if (filters?.priority && filters.priority !== 'All') params = params.set('priority', filters.priority);
    if (filters?.divisionScope && filters.divisionScope !== 'All') params = params.set('divisionScope', filters.divisionScope);
    if (filters?.studentId) params = params.set('studentId', filters.studentId);
    if (filters?.searchTerm) params = params.set('searchTerm', filters.searchTerm);
    return this.http.get<GrievanceTicket[]>(`${this.apiUrl}`, { params });
  }

  getTicketDetails(id: string): Observable<{ ticket: GrievanceTicket; comments: GrievanceComment[] }> {
    return this.http.get<{ ticket: GrievanceTicket; comments: GrievanceComment[] }>(`${this.apiUrl}/${id}`);
  }

  createTicket(payload: any): Observable<GrievanceTicket> {
    return this.http.post<GrievanceTicket>(`${this.apiUrl}`, payload);
  }

  updateStatus(id: string, payload: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/status`, payload);
  }

  addComment(id: string, payload: any): Observable<GrievanceComment> {
    return this.http.post<GrievanceComment>(`${this.apiUrl}/${id}/comments`, payload);
  }

  deleteTicket(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
