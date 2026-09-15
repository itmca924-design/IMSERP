import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

export interface UpdateTenantDto {
  name: string;
  contactPhone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  whatsAppPhoneId?: string | null;
  whatsAppAccessToken?: string | null;
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

  getTenantById(id: string): Observable<TenantDto> {
    return this.http.get<TenantDto>(`${this.API_URL}/${id}`);
  }

  createTenant(dto: CreateTenantDto): Observable<TenantDto> {
    return this.http.post<TenantDto>(this.API_URL, dto);
  }

  updateTenant(id: string, dto: UpdateTenantDto): Observable<any> {
    return this.http.put(`${this.API_URL}/${id}`, dto);
  }

  toggleTenantStatus(id: string): Observable<any> {
    return this.http.patch(`${this.API_URL}/${id}/toggle-status`, {});
  }
}
