import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface BranchDto {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address?: string | null;
  contactPhone?: string | null;
  isMainBranch: boolean;
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  batchCount: number;
  roomCount: number;
}

export interface CreateBranchDto {
  name: string;
  code: string;
  address?: string | null;
  contactPhone?: string | null;
  isMainBranch?: boolean;
}

export interface UpdateBranchDto {
  name: string;
  address?: string | null;
  contactPhone?: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BranchService {
  private readonly API_URL = 'http://localhost:5000/api/branches';

  constructor(private http: HttpClient) {}

  getBranches(): Observable<BranchDto[]> {
    return this.http.get<BranchDto[]>(this.API_URL);
  }

  getBranchById(id: string): Observable<BranchDto> {
    return this.http.get<BranchDto>(`${this.API_URL}/${id}`);
  }

  createBranch(dto: CreateBranchDto): Observable<BranchDto> {
    return this.http.post<BranchDto>(this.API_URL, dto);
  }

  updateBranch(id: string, dto: UpdateBranchDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.API_URL}/${id}`, dto);
  }

  toggleBranchStatus(id: string): Observable<{ message: string; isActive: boolean }> {
    return this.http.patch<{ message: string; isActive: boolean }>(`${this.API_URL}/${id}/toggle-status`, {});
  }
}
