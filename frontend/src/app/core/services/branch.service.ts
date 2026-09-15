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

  getAllBranches(): Observable<BranchDto[]> {
    return this.http.get<BranchDto[]>(this.API_URL);
  }

  getBranches(): Observable<BranchDto[]> {
    return this.getAllBranches();
  }

  getBranchById(id: string): Observable<BranchDto> {
    return this.http.get<BranchDto>(`${this.API_URL}/${id}`);
  }

  createBranch(dto: CreateBranchDto): Observable<BranchDto> {
    return this.http.post<BranchDto>(this.API_URL, dto);
  }

  updateBranch(id: string, dto: UpdateBranchDto): Observable<BranchDto> {
    return this.http.put<BranchDto>(`${this.API_URL}/${id}`, dto);
  }

  deleteBranch(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/${id}`);
  }
}
