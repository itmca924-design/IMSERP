import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SectionPeriodRoutineDto, CreateSectionPeriodRequestDto } from './school.service';
import { StudentWeeklyTimetableDto } from './coaching.service';

export interface BatchDto {
  id: string;
  name: string;
  subject: string;
  academicYear: string;
  standardMonthlyFee: number;
  studentCount: number;
  branchId?: string | null;
  branchName?: string | null;
  roomId?: string | null;
  roomNumber?: string | null;
  roomName?: string | null;
  classId?: string | null;
  className?: string | null;
  courseName?: string | null;
  mentorTeacherId?: string | null;
  mentorTeacherName?: string | null;
  mentorTeacherPhone?: string | null;
}

export interface CreateBatchDto {
  name: string;
  subject: string;
  academicYear: string;
  standardMonthlyFee: number;
  branchId?: string | null;
  roomId?: string | null;
  classId?: string | null;
  courseName?: string | null;
  mentorTeacherId?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class BatchesService {
  private readonly BASE_URL = `${environment.apiUrl}/batches`;

  constructor(private http: HttpClient) {}

  getBatchesPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    sortBy: string = 'name',
    sortDescending: boolean = false,
    academicYear: string = '',
    classId: string = ''
  ): Observable<PagedResult<BatchDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortBy', sortBy)
      .set('sortDescending', sortDescending.toString());

    if (searchTerm) {
      params = params.set('searchTerm', searchTerm);
    }

    if (academicYear) {
      params = params.set('academicYear', academicYear);
    }

    if (classId) {
      params = params.set('classId', classId);
    }

    return this.http.get<PagedResult<BatchDto>>(`${this.BASE_URL}/paged`, { params });
  }

  getBatches(): Observable<BatchDto[]> {
    return this.http.get<BatchDto[]>(this.BASE_URL);
  }

  getBatchById(id: string): Observable<BatchDto> {
    return this.http.get<BatchDto>(`${this.BASE_URL}/${id}`);
  }

  createBatch(batch: CreateBatchDto): Observable<BatchDto> {
    return this.http.post<BatchDto>(this.BASE_URL, batch);
  }

  updateBatch(id: string, batch: CreateBatchDto): Observable<BatchDto> {
    return this.http.put<BatchDto>(`${this.BASE_URL}/${id}`, batch);
  }

  deleteBatch(id: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/${id}`);
  }

  getBatchRoutine(batchId: string): Observable<SectionPeriodRoutineDto[]> {
    return this.http.get<SectionPeriodRoutineDto[]>(`${this.BASE_URL}/${batchId}/routine`);
  }

  addBatchPeriod(batchId: string, dto: CreateSectionPeriodRequestDto): Observable<SectionPeriodRoutineDto> {
    return this.http.post<SectionPeriodRoutineDto>(`${this.BASE_URL}/${batchId}/routine`, dto);
  }

  updateBatchPeriod(assignmentId: string, dto: CreateSectionPeriodRequestDto): Observable<SectionPeriodRoutineDto> {
    return this.http.put<SectionPeriodRoutineDto>(`${this.BASE_URL}/routine/${assignmentId}`, dto);
  }

  removeBatchPeriod(assignmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.BASE_URL}/routine/${assignmentId}`);
  }

  getBatchTimetable(batchId: string, dayOfWeek?: string): Observable<StudentWeeklyTimetableDto> {
    const params: any = {};
    if (dayOfWeek) params.dayOfWeek = dayOfWeek;
    return this.http.get<StudentWeeklyTimetableDto>(`${this.BASE_URL}/${batchId}/timetable`, { params });
  }

  assignBatchMentor(batchId: string, mentorTeacherId: string | null): Observable<BatchDto> {
    return this.http.put<BatchDto>(`${this.BASE_URL}/${batchId}/mentor`, { mentorTeacherId });
  }
}
