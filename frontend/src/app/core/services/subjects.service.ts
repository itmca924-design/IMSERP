import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SubjectDto {
  id: string;
  name: string;
  code?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSubjectDto {
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SubjectsService {
  private readonly BASE_URL = 'http://localhost:5000/api/subjects';

  constructor(private http: HttpClient) {}

  getSubjects(activeOnly: boolean = false): Observable<SubjectDto[]> {
    return this.http.get<SubjectDto[]>(this.BASE_URL, { params: activeOnly ? { activeOnly: 'true' } : {} });
  }

  getSubjectsPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    sortBy: string = 'Name',
    sortDescending: boolean = false,
    isActive?: boolean | null
  ): Observable<any> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortBy', sortBy)
      .set('sortDescending', sortDescending.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }

    if (isActive !== undefined && isActive !== null) {
      params = params.set('isActive', isActive.toString());
    }

    return this.http.get<any>(`${this.BASE_URL}/paged`, { params });
  }

  getSubjectById(id: string): Observable<SubjectDto> {
    return this.http.get<SubjectDto>(`${this.BASE_URL}/${id}`);
  }

  createSubject(subject: CreateSubjectDto): Observable<SubjectDto> {
    return this.http.post<SubjectDto>(this.BASE_URL, subject);
  }

  updateSubject(id: string, subject: CreateSubjectDto): Observable<SubjectDto> {
    return this.http.put<SubjectDto>(`${this.BASE_URL}/${id}`, subject);
  }

  deleteSubject(id: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/${id}`);
  }
}
