import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TenantModulesDto {
  hasSchoolModule: boolean;
  hasCoachingModule: boolean;
  hasHostelModule: boolean;
  hasLibraryModule: boolean;
  hasTransportModule: boolean;
}

export interface TenantDto {
  id: string;
  name: string;
  code: string;
  contactPhone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  whatsAppPhoneId?: string | null;
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  batchCount: number;
  hasSchoolModule?: boolean;
  hasCoachingModule?: boolean;
  hasHostelModule?: boolean;
  hasLibraryModule?: boolean;
  hasTransportModule?: boolean;
  licensedModules?: string | null;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  paidUntil?: string | null;
  maxStudentsLimit?: number;
  maxBranchesLimit?: number;
}

export interface CreateBranchItemDto {
  name: string;
  code: string;
  address?: string | null;
  contactPhone?: string | null;
  isMainBranch?: boolean;
}

export interface CreateTenantDto {
  name: string;
  code: string;
  contactPhone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  whatsAppPhoneId?: string | null;
  whatsAppAccessToken?: string | null;
  adminUsername: string;
  adminPassword: string;
  adminFullName: string;
  branches?: CreateBranchItemDto[];
  hasSchoolModule?: boolean;
  hasCoachingModule?: boolean;
  hasHostelModule?: boolean;
  hasLibraryModule?: boolean;
  hasTransportModule?: boolean;
  licensedModules?: string | null;
  subscriptionPlan?: string;
  maxStudentsLimit?: number;
  maxBranchesLimit?: number;
}

export interface UpdateTenantDto {
  name: string;
  contactPhone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  whatsAppPhoneId?: string | null;
  whatsAppAccessToken?: string | null;
  hasSchoolModule?: boolean;
  hasCoachingModule?: boolean;
  hasHostelModule?: boolean;
  hasLibraryModule?: boolean;
  hasTransportModule?: boolean;
  licensedModules?: string | null;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
  trialEndDate?: string | null;
  paidUntil?: string | null;
  maxStudentsLimit?: number;
  maxBranchesLimit?: number;
}

export interface MySubscriptionDto {
  tenantId: string;
  instituteName: string;
  tenantCode: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  paidUntil?: string | null;
  trialDaysLeft?: number | null;
  studentCount: number;
  maxStudentsLimit: number;
  branchCount: number;
  maxBranchesLimit: number;
  hasSchoolModule: boolean;
  hasCoachingModule: boolean;
  hasHostelModule: boolean;
  hasLibraryModule: boolean;
  hasTransportModule: boolean;
  licensedModules?: string | null;
  isSubscriptionExpired?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private readonly API_URL = 'http://localhost:5000/api/tenants';

  constructor(private http: HttpClient) {}

  getAllTenants(): Observable<TenantDto[]> {
    return this.http.get<TenantDto[]>(this.API_URL);
  }

  getCurrentTenant(): Observable<TenantDto> {
    return this.http.get<TenantDto>(`${this.API_URL}/current`);
  }

  getTenantById(id: string): Observable<TenantDto> {
    return this.http.get<TenantDto>(`${this.API_URL}/${id}`);
  }

  getMySubscription(tenantId?: string): Observable<MySubscriptionDto> {
    const params = tenantId ? `?tenantId=${tenantId}` : '';
    return this.http.get<MySubscriptionDto>(`${this.API_URL}/my-subscription${params}`);
  }

  extendSubscription(id: string, dto: {
    daysToAdd?: number;
    newEndDate?: string;
    newPlan?: string;
    newStatus?: string;
    maxStudentsLimit?: number;
    maxBranchesLimit?: number;
  }): Observable<any> {
    return this.http.post(`${this.API_URL}/${id}/extend-subscription`, dto);
  }

  createTenant(dto: CreateTenantDto): Observable<TenantDto> {
    return this.http.post<TenantDto>(this.API_URL, dto);
  }

  updateTenant(id: string, dto: UpdateTenantDto): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}`, dto);
  }

  updateTenantModules(id: string, dto: TenantModulesDto): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}/modules`, dto);
  }

  toggleTenantStatus(id: string): Observable<any> {
    return this.http.patch(`${this.API_URL}/${id}/toggle-status`, {});
  }
}
