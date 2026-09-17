import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

export interface LibraryBookDto {
  id: string;
  tenantId: string;
  branchId?: string;
  title: string;
  author: string;
  publisher?: string;
  edition?: string;
  isbn?: string;
  category: string;
  subject?: string;
  classId?: string;
  className?: string;
  description?: string;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  createdAt: string;
  isActive: boolean;
  copies?: BookCopyDto[];
}

export interface CreateLibraryBookDto {
  title: string;
  author: string;
  publisher?: string;
  edition?: string;
  isbn?: string;
  category: string;
  subject?: string;
  classId?: string;
  description?: string;
  initialCopiesCount: number;
  initialRackLocation?: string;
  initialPrice: number;
}

export interface UpdateLibraryBookDto {
  title: string;
  author: string;
  publisher?: string;
  edition?: string;
  isbn?: string;
  category: string;
  subject?: string;
  classId?: string;
  description?: string;
  isActive: boolean;
}

export interface BookCopyDto {
  id: string;
  tenantId: string;
  branchId?: string;
  bookId: string;
  bookTitle: string;
  author: string;
  accessionNumber: string;
  barcode?: string;
  rackLocation?: string;
  price: number;
  status: string; // 'Available', 'Issued', 'Lost', 'Damaged', 'ReferenceOnly'
  conditionNotes?: string;
  createdAt: string;
  isActive: boolean;
}

export interface CreateBookCopyDto {
  bookId: string;
  accessionNumber: string;
  barcode?: string;
  rackLocation?: string;
  price: number;
  conditionNotes?: string;
}

export interface UpdateBookCopyDto {
  accessionNumber: string;
  barcode?: string;
  rackLocation?: string;
  price: number;
  status: string;
  conditionNotes?: string;
  isActive: boolean;
}

export interface IssueBookDto {
  accessionNumber: string;
  studentId?: string;
  teacherId?: string;
  memberType: string; // 'Student' or 'Teacher'
  customDueDays?: number;
  remarks?: string;
}

export interface ReturnBookDto {
  accessionNumber: string;
  remarks?: string;
  collectedFineAmount?: number;
  finePaymentStatus: string; // 'Paid', 'Pending', 'Waived'
}

export interface LibraryCirculationDto {
  id: string;
  bookCopyId: string;
  accessionNumber: string;
  bookTitle: string;
  author: string;
  rackLocation?: string;
  studentId?: string;
  studentName?: string;
  studentRollNumber?: string;
  studentAdmissionNumber?: string;
  studentClassName?: string;
  studentBatchName?: string;
  parentWhatsAppPhone?: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmployeeCode?: string;
  memberType: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string;
  status: string;
  overdueDays: number;
  finePerDay: number;
  fineAmount: number;
  fineStatus: string;
  remarks?: string;
}

export interface LibraryStatsDto {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueCount: number;
  totalFinesCollected: number;
  totalFinesPending: number;
}

export interface LibrarySettingDto {
  id: string;
  maxBooksPerStudent: number;
  maxBooksPerTeacher: number;
  studentIssueDays: number;
  teacherIssueDays: number;
  dailyFineRate: number;
  allowFineWaiver: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  private apiUrl = `${API_BASE}/library`;

  constructor(private http: HttpClient) {}

  getBooks(params?: {
    searchTerm?: string;
    category?: string;
    classId?: string;
    subject?: string;
    activeOnly?: boolean;
  }): Observable<LibraryBookDto[]> {
    let httpParams = new HttpParams();
    if (params?.searchTerm && params.searchTerm.trim()) {
      httpParams = httpParams.set('searchTerm', params.searchTerm.trim());
    }
    if (params?.category && params.category !== 'All') {
      httpParams = httpParams.set('category', params.category);
    }
    if (params?.classId && params.classId !== 'null' && params.classId !== 'undefined') {
      httpParams = httpParams.set('classId', params.classId);
    }
    if (params?.subject && params.subject !== 'All') {
      httpParams = httpParams.set('subject', params.subject);
    }
    if (params?.activeOnly !== undefined) {
      httpParams = httpParams.set('activeOnly', params.activeOnly.toString());
    }
    return this.http.get<LibraryBookDto[]>(`${this.apiUrl}/books`, { params: httpParams });
  }

  getBookById(id: string): Observable<LibraryBookDto> {
    return this.http.get<LibraryBookDto>(`${this.apiUrl}/books/${id}`);
  }

  createBook(dto: CreateLibraryBookDto): Observable<LibraryBookDto> {
    return this.http.post<LibraryBookDto>(`${this.apiUrl}/books`, dto);
  }

  updateBook(id: string, dto: UpdateLibraryBookDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/books/${id}`, dto);
  }

  deleteBook(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/books/${id}`);
  }

  lookupCopy(query: string): Observable<BookCopyDto> {
    return this.http.get<BookCopyDto>(`${this.apiUrl}/copies/lookup`, { params: { query } });
  }

  createCopy(dto: CreateBookCopyDto): Observable<BookCopyDto> {
    return this.http.post<BookCopyDto>(`${this.apiUrl}/copies`, dto);
  }

  updateCopy(id: string, dto: UpdateBookCopyDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/copies/${id}`, dto);
  }

  deleteCopy(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/copies/${id}`);
  }

  issueBook(dto: IssueBookDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/circulation/issue`, dto);
  }

  returnBook(dto: ReturnBookDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/circulation/return`, dto);
  }

  getActiveCirculations(params?: { overdueOnly?: boolean; searchTerm?: string }): Observable<LibraryCirculationDto[]> {
    let httpParams = new HttpParams();
    if (params?.overdueOnly !== undefined) {
      httpParams = httpParams.set('overdueOnly', params.overdueOnly.toString());
    }
    if (params?.searchTerm && params.searchTerm.trim()) {
      httpParams = httpParams.set('searchTerm', params.searchTerm.trim());
    }
    return this.http.get<LibraryCirculationDto[]>(`${this.apiUrl}/circulation/active`, { params: httpParams });
  }

  getCirculationHistory(take: number = 50): Observable<LibraryCirculationDto[]> {
    return this.http.get<LibraryCirculationDto[]>(`${this.apiUrl}/circulation/history`, { params: { take } });
  }

  getStats(): Observable<LibraryStatsDto> {
    return this.http.get<LibraryStatsDto>(`${this.apiUrl}/stats`);
  }

  getSettings(): Observable<LibrarySettingDto> {
    return this.http.get<LibrarySettingDto>(`${this.apiUrl}/settings`);
  }

  updateSettings(dto: Partial<LibrarySettingDto>): Observable<any> {
    return this.http.put(`${this.apiUrl}/settings`, dto);
  }
}
