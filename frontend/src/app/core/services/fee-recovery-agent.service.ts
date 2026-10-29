import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeeRecoveryPlanItemDto {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  parentName?: string;
  parentPhone?: string;
  profilePhoto?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  totalOverdueAmount: number;
  daysOverdue: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Critical';
  status: 'Proposed' | 'Dispatched' | 'PromiseMade' | 'PromiseKept' | 'PromiseBroken' | 'Resolved';
  recommendedChannel: string;
  recommendedTone: string;
  generatedMessage: string;
  aiRationale?: string;
  followUpCount: number;
  lastFollowUpAt?: string;
  nextFollowUpScheduledAt?: string;
  activePromiseDate?: string;
  activePromiseAmount?: number;
  activePromiseContact?: string;
  createdAt: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  divisionTag?: string;
}

export interface FeeRecoverySummaryKpiDto {
  totalOverdueAmount: number;
  totalDefaultersCount: number;
  criticalCount: number;
  highRiskCount: number;
  moderateCount: number;
  lowRiskCount: number;
  activePromisesCount: number;
  activePromisesAmount: number;
  recoveredCount: number;
  totalRecoveredAmount: number;
  lastAnalysisRunAt?: string;
}

export interface FeePromiseItemDto {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  className?: string;
  batchName?: string;
  promisedAmount: number;
  promisedDate: string;
  contactPerson: string;
  contactPhone: string;
  notes?: string;
  isKept: boolean;
  isBroken: boolean;
  settledAt?: string;
  settledAmount?: number;
  recordedByName: string;
  createdAt: string;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  divisionTag?: string;
}

export interface RunAnalysisRequest {
  branchId?: string | null;
  classId?: string | null;
  batchId?: string | null;
  minDaysOverdue?: number;
  academicScope?: string;
}

export interface RecordPromiseRequest {
  studentId: string;
  recoveryPlanId?: string | null;
  invoiceId?: string | null;
  promisedAmount: number;
  promisedDate: string;
  contactPerson: string;
  contactPhone: string;
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeeRecoveryAgentService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/finance/fee-recovery-agent`;

  getSummary(branchId?: string | null, academicScope: string = 'All'): Observable<FeeRecoverySummaryKpiDto> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    if (academicScope) params = params.set('academicScope', academicScope);
    return this.http.get<FeeRecoverySummaryKpiDto>(`${this.baseUrl}/summary`, { params });
  }

  getPlans(
    branchId?: string | null,
    classId?: string | null,
    batchId?: string | null,
    riskLevel?: string | null,
    status?: string | null,
    academicScope: string = 'All'
  ): Observable<FeeRecoveryPlanItemDto[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    if (classId) params = params.set('classId', classId);
    if (batchId) params = params.set('batchId', batchId);
    if (riskLevel) params = params.set('riskLevel', riskLevel);
    if (status) params = params.set('status', status);
    if (academicScope) params = params.set('academicScope', academicScope);

    return this.http.get<FeeRecoveryPlanItemDto[]>(`${this.baseUrl}/plans`, { params });
  }

  runAnalysis(req: RunAnalysisRequest): Observable<FeeRecoveryPlanItemDto[]> {
    return this.http.post<FeeRecoveryPlanItemDto[]>(`${this.baseUrl}/run-analysis`, req);
  }

  dispatchNudge(planId: string, customMessage?: string, overrideChannel?: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/dispatch-nudge`, {
      planId,
      customMessage,
      overrideChannel
    });
  }

  batchDispatchNudges(planIds: string[]): Observable<number> {
    return this.http.post<number>(`${this.baseUrl}/batch-dispatch-nudges`, { planIds });
  }

  recordPromise(req: RecordPromiseRequest): Observable<FeePromiseItemDto> {
    return this.http.post<FeePromiseItemDto>(`${this.baseUrl}/record-promise`, req);
  }

  getPromises(branchId?: string | null, pendingOnly: boolean = false, academicScope: string = 'All'): Observable<FeePromiseItemDto[]> {
    let params = new HttpParams().set('pendingOnly', pendingOnly.toString());
    if (branchId) params = params.set('branchId', branchId);
    if (academicScope) params = params.set('academicScope', academicScope);
    return this.http.get<FeePromiseItemDto[]>(`${this.baseUrl}/promises`, { params });
  }

  updatePromiseStatus(promiseId: string, isKept: boolean, isBroken: boolean, settledAmount?: number, notes?: string): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/promises/${promiseId}`, {
      isKept,
      isBroken,
      settledAmount,
      notes
    });
  }
}

