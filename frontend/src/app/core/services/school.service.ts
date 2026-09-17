import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
const API_BASE = 'http://localhost:5000/api';

export interface SchoolClassDto {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  branchId?: string;
  sectionCount: number;
  studentCount: number;
  sections?: SchoolSectionDto[];
}

export interface CreateSchoolClassDto {
  name: string;
  code?: string;
  displayOrder?: number;
  branchId?: string;
}

export interface UpdateSchoolClassDto {
  name: string;
  code?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SchoolSectionDto {
  id: string;
  tenantId: string;
  classId: string;
  className?: string;
  name: string;
  maxCapacity: number;
  roomId?: string;
  roomNumber?: string;
  isActive: boolean;
  createdAt: string;
  branchId?: string;
  studentCount: number;
}

export interface CreateSchoolSectionDto {
  classId: string;
  name: string;
  maxCapacity?: number;
  roomId?: string;
  branchId?: string;
}

export interface UpdateSchoolSectionDto {
  name: string;
  maxCapacity: number;
  roomId?: string;
  isActive: boolean;
}

export interface EnrollSchoolStudentInCoachingDto {
  studentId: string;
  batchId: string;
  coachingRollNumber?: string;
  customMonthlyFee?: number;
}

export interface UnifiedStatsDto {
  totalSchoolStudents: number;
  totalCoachingStudents: number;
  dualEnrolledStudents: number;
  totalClasses: number;
  totalBatches: number;
}

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private apiUrl = `${API_BASE}/school`;

  constructor(private http: HttpClient) {}

  getClasses(activeOnly: boolean = false): Observable<SchoolClassDto[]> {
    return this.http.get<SchoolClassDto[]>(`${this.apiUrl}/classes`, {
      params: { activeOnly }
    });
  }

  getClassById(id: string): Observable<SchoolClassDto> {
    return this.http.get<SchoolClassDto>(`${this.apiUrl}/classes/${id}`);
  }

  createClass(dto: CreateSchoolClassDto): Observable<SchoolClassDto> {
    return this.http.post<SchoolClassDto>(`${this.apiUrl}/classes`, dto);
  }

  updateClass(id: string, dto: UpdateSchoolClassDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/classes/${id}`, dto);
  }

  deleteClass(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/classes/${id}`);
  }

  getSections(classId?: string): Observable<SchoolSectionDto[]> {
    const params: any = {};
    if (classId) params.classId = classId;
    return this.http.get<SchoolSectionDto[]>(`${this.apiUrl}/sections`, { params });
  }

  createSection(dto: CreateSchoolSectionDto): Observable<SchoolSectionDto> {
    return this.http.post<SchoolSectionDto>(`${this.apiUrl}/sections`, dto);
  }

  updateSection(id: string, dto: UpdateSchoolSectionDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/sections/${id}`, dto);
  }

  deleteSection(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/sections/${id}`);
  }

  searchSchoolStudents(query: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/students/search`, {
      params: { query }
    });
  }

  enrollInCoaching(dto: EnrollSchoolStudentInCoachingDto): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/students/enroll-coaching`, dto);
  }

  enrollSchoolStudentInCoaching(dto: EnrollSchoolStudentInCoachingDto): Observable<any> {
    return this.enrollInCoaching(dto);
  }

  getUnifiedStats(): Observable<UnifiedStatsDto> {
    return this.http.get<UnifiedStatsDto>(`${this.apiUrl}/stats`);
  }
}
