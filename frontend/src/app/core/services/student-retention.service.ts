import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StudentDropoutRiskItemDto {
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string;
  photoUrl?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  batchId?: string;
  batchName?: string;
  branchId?: string;
  branchName?: string;
  parentName: string;
  parentPhone: string;
  isSchoolStudent: boolean;
  isCoachingStudent: boolean;
  riskScore: number;
  riskLevel: 'Critical' | 'Moderate' | 'Safe';
  attendancePercentage: number;
  consecutiveAbsentDays: number;
  overdueFeeAmount: number;
  overdueFeeDays: number;
  latestTestPercentage?: number;
  primaryRiskFactor: string;
  recommendedAction: string;
  generatedOutreachMessageHindi: string;
  generatedOutreachMessageEnglish: string;
  previousInterventionsCount: number;
  lastInterventionDate?: string;
  lastInterventionOutcome?: string;
}

export interface StudentDropoutRiskSummaryKpiDto {
  totalStudentsMonitored: number;
  criticalRiskCount: number;
  moderateRiskCount: number;
  safeCount: number;
  potentialFeeAtRisk: number;
  interventionsCompletedCount: number;
  studentsRetainedCount: number;
}

export interface StudentRetentionAnalysisResponse {
  items: StudentDropoutRiskItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
  summary: StudentDropoutRiskSummaryKpiDto;
}

export interface StudentRetentionInterventionDto {
  id: string;
  studentId: string;
  studentName: string;
  interventionDate: string;
  interventionType: string;
  counselorName: string;
  parentFeedback?: string;
  reasonForRisk: string;
  outcomeStatus: string;
  nextFollowUpDate?: string;
  actionNotes?: string;
  createdBy: string;
  createdAt: string;
}

export interface RecordRetentionInterventionRequestDto {
  studentId: string;
  interventionType: string;
  counselorName?: string;
  parentFeedback?: string;
  reasonForRisk: string;
  outcomeStatus: string;
  nextFollowUpDate?: string;
  actionNotes?: string;
}

export interface RetentionWhatsAppOutreachRequestDto {
  studentId: string;
  recipientPhone: string;
  messageText: string;
  language?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StudentRetentionService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/student-retention`;

  getRetentionAnalysis(params: {
    branchId?: string | null;
    classId?: string | null;
    batchId?: string | null;
    academicScope?: string;
    riskLevel?: string;
    search?: string | null;
    page?: number;
    pageSize?: number;
  }): Observable<StudentRetentionAnalysisResponse> {
    let httpParams = new HttpParams();
    if (params.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params.classId) httpParams = httpParams.set('classId', params.classId);
    if (params.batchId) httpParams = httpParams.set('batchId', params.batchId);
    if (params.academicScope) httpParams = httpParams.set('academicScope', params.academicScope);
    if (params.riskLevel) httpParams = httpParams.set('riskLevel', params.riskLevel);
    if (params.search) httpParams = httpParams.set('search', params.search.trim());
    if (params.page) httpParams = httpParams.set('page', params.page.toString());
    if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());

    return this.http.get<StudentRetentionAnalysisResponse>(`${this.apiUrl}/analysis`, { params: httpParams });
  }

  getRetentionSummary(branchId?: string | null): Observable<StudentDropoutRiskSummaryKpiDto> {
    let httpParams = new HttpParams();
    if (branchId) httpParams = httpParams.set('branchId', branchId);
    return this.http.get<StudentDropoutRiskSummaryKpiDto>(`${this.apiUrl}/summary`, { params: httpParams });
  }

  getInterventions(studentId: string): Observable<StudentRetentionInterventionDto[]> {
    return this.http.get<StudentRetentionInterventionDto[]>(`${this.apiUrl}/${studentId}/interventions`);
  }

  recordIntervention(dto: RecordRetentionInterventionRequestDto): Observable<StudentRetentionInterventionDto> {
    return this.http.post<StudentRetentionInterventionDto>(`${this.apiUrl}/intervention`, dto);
  }

  sendWhatsAppOutreach(dto: RetentionWhatsAppOutreachRequestDto): Observable<{ success: boolean; cloudDispatched: boolean; interventionId?: string }> {
    return this.http.post<{ success: boolean; cloudDispatched: boolean; interventionId?: string }>(`${this.apiUrl}/whatsapp-outreach`, dto);
  }
}
