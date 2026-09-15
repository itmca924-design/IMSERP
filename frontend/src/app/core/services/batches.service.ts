import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

export interface CreateBatchDto {
  name: string;
  subject: string;
  academicYear: string;
  standardMonthlyFee: number;
  branchId?: string | null;
  roomId?: string | null;
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
  private readonly BASE_URL = 'http://localhost:5000/api/batches';

  constructor(private http: HttpClient) {}

  getBatchesPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    sortBy: string = 'name',
    sortDescending: boolean = false,
    academicYear: string = ''
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
}
