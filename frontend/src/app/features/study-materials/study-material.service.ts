import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  StudyMaterialDto,
  CreateStudyMaterialDto,
  StudyMaterialStatsDto,
  StudyMaterialPagedResult
} from './study-material.models';

@Injectable({
  providedIn: 'root'
})
export class StudyMaterialService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5000/api/study-materials';

  getMaterials(filters: {
    scope?: string;
    classId?: string;
    sectionId?: string;
    batchId?: string;
    subject?: string;
    materialType?: string;
    targetExam?: string;
    examYear?: string;
    chapter?: string;
    search?: string;
    hasSolutions?: boolean;
    studentId?: string;
    page?: number;
    pageSize?: number;
  }): Observable<StudyMaterialPagedResult> {
    let params = new HttpParams();

    if (filters.scope && filters.scope !== 'All') params = params.set('scope', filters.scope);
    if (filters.classId) params = params.set('classId', filters.classId);
    if (filters.sectionId) params = params.set('sectionId', filters.sectionId);
    if (filters.batchId) params = params.set('batchId', filters.batchId);
    if (filters.subject && filters.subject !== 'All') params = params.set('subject', filters.subject);
    if (filters.materialType && filters.materialType !== 'All') params = params.set('materialType', filters.materialType);
    if (filters.targetExam && filters.targetExam !== 'All') params = params.set('targetExam', filters.targetExam);
    if (filters.examYear && filters.examYear !== 'All') params = params.set('examYear', filters.examYear);
    if (filters.chapter) params = params.set('chapter', filters.chapter);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.hasSolutions !== undefined && filters.hasSolutions !== null) {
      params = params.set('hasSolutions', filters.hasSolutions.toString());
    }
    if (filters.studentId) params = params.set('studentId', filters.studentId);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.pageSize) params = params.set('pageSize', filters.pageSize.toString());

    return this.http.get<StudyMaterialPagedResult>(this.apiUrl, { params });
  }

  getStats(scope?: string): Observable<StudyMaterialStatsDto> {
    let params = new HttpParams();
    if (scope && scope !== 'All') params = params.set('scope', scope);
    return this.http.get<StudyMaterialStatsDto>(`${this.apiUrl}/stats`, { params });
  }

  getById(id: string): Observable<StudyMaterialDto> {
    return this.http.get<StudyMaterialDto>(`${this.apiUrl}/${id}`);
  }

  uploadFile(file: File, type: 'file' | 'solution' = 'file'): Observable<{ fileUrl: string; fileName: string; fileSize: number; fileFormat: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    return this.http.post<{ fileUrl: string; fileName: string; fileSize: number; fileFormat: string }>(`${this.apiUrl}/upload`, formData);
  }

  create(dto: CreateStudyMaterialDto): Observable<StudyMaterialDto> {
    return this.http.post<StudyMaterialDto>(this.apiUrl, dto);
  }

  update(id: string, dto: any): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  trackDownload(id: string): Observable<{ downloadCount: number }> {
    return this.http.post<{ downloadCount: number }>(`${this.apiUrl}/${id}/track-download`, {});
  }
}
