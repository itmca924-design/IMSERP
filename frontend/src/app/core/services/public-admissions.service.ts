import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PublicBranch {
  id: string;
  name: string;
  code: string;
  address?: string;
  contactPhone?: string;
}

export interface PublicClass {
  id: string;
  name: string;
  branchId?: string;
}

export interface PublicBatch {
  id: string;
  name: string;
  subject?: string;
  standardMonthlyFee: number;
  branchId?: string;
}

export interface PublicInstituteDetails {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  address?: string;
  contactPhone?: string;
  profilePhoto?: string;
  branches: PublicBranch[];
  classes: PublicClass[];
  batches: PublicBatch[];
  academicYears: string[];
}

export interface PublicAdmissionApplication {
  tenantCode?: string;
  tenantId?: string;
  branchId?: string;
  studentName: string;
  dateOfBirth?: string | null;
  gender?: string;
  bloodGroup?: string;
  category?: string;
  aadhaarNumber?: string;
  parentName: string;
  motherName?: string;
  fatherOccupation?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  admissionStream?: string; // 'School' | 'Coaching'
  interestedClassId?: string | null;
  interestedClassName?: string | null;
  interestedBatchId?: string | null;
  interestedBatchName?: string | null;
  academicYear?: string;
  previousSchoolName?: string;
  previousMarks?: string;
  requiresTransport: boolean;
  requiresHostel: boolean;
  remarks?: string;
}

export interface PublicAdmissionResponse {
  success: boolean;
  applicationNumber: string;
  studentName: string;
  submissionDate: string;
  instituteName: string;
  branchName?: string;
  message: string;
}

export interface ApplicationTrackingResult {
  found: boolean;
  applicationNumber?: string;
  studentName?: string;
  parentName?: string;
  phone?: string;
  className?: string;
  branchName?: string;
  status?: string;
  applicationDate?: string;
  remarks?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PublicAdmissionsService {
  private readonly baseUrl = `${environment.apiUrl}/public/admissions`;

  constructor(private http: HttpClient) {}

  getInstituteDetails(tenantCode?: string, tenantId?: string): Observable<PublicInstituteDetails> {
    let params = new HttpParams();
    if (tenantCode) params = params.set('tenantCode', tenantCode);
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<PublicInstituteDetails>(`${this.baseUrl}/institute-details`, { params });
  }

  submitApplication(payload: PublicAdmissionApplication): Observable<PublicAdmissionResponse> {
    return this.http.post<PublicAdmissionResponse>(`${this.baseUrl}/apply`, payload);
  }

  trackStatus(applicationNumber: string, phone: string): Observable<ApplicationTrackingResult> {
    let params = new HttpParams().set('phone', phone);
    return this.http.get<ApplicationTrackingResult>(`${this.baseUrl}/status/${encodeURIComponent(applicationNumber)}`, { params });
  }
}
