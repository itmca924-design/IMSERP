import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

export interface FeeInvoiceItem {
  id: string;
  invoiceId: string;
  feeHeadId?: string;
  headName: string;
  amount: number;
  paidAmount: number;
}

export interface FeeHead {
  id: string;
  name: string;
  code: string;
  category: string;
  frequency: string;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

export interface CreateFeeHeadPayload {
  name: string;
  code: string;
  category: string;
  frequency: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateFeeHeadPayload {
  name: string;
  code: string;
  category: string;
  frequency: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  isDefault?: boolean;
}

export interface PagedFeeHeadResult {
  items: FeeHead[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface ClassFeeStructureItem {
  id: string;
  classId?: string;
  className?: string;
  batchId?: string;
  batchName?: string;
  feeHeadId: string;
  feeHeadName: string;
  feeHeadCode: string;
  category: string;
  frequency: string;
  amount: number;
  applicableMonth?: number | null;
  isActive: boolean;
}

export interface SaveClassFeeStructureItem {
  id?: string;
  classId?: string;
  batchId?: string;
  feeHeadId: string;
  amount: number;
  applicableMonth?: number | null;
  isActive?: boolean;
}

export interface SaveClassFeeStructureBatch {
  classId?: string;
  batchId?: string;
  items: SaveClassFeeStructureItem[];
}

export interface FeeInvoicePagedItem {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentWhatsAppPhone: string;
  invoiceNumber: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  status: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  items?: FeeInvoiceItem[];
}

export interface StudentLedgerInvoiceItem {
  id: string;
  invoiceNumber: string;
  title: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  status: string;
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  items?: FeeInvoiceItem[];
}

export interface StudentLedgerPaymentItem {
  paymentId: string;
  receiptNumber: string;
  invoiceNumber: string;
  amountPaid: number;
  mode: number | string;
  transactionRef?: string;
  remarks?: string;
  paymentDate: string;
}

export interface StudentLedger {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentName: string;
  parentWhatsAppPhone: string;
  standardMonthlyFee: number;
  totalFeesCharged: number;
  totalFeesPaid: number;
  totalOutstandingDue: number;
  invoices: StudentLedgerInvoiceItem[];
  payments: StudentLedgerPaymentItem[];
  pendingLibraryFine?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface CollectFifoFeePayload {
  studentId: string;
  amountPaid: number;
  mode: number;
  transactionRef?: string;
  remarks?: string;
  sendWhatsAppReceipt: boolean;
  includeLibraryFine?: boolean;
  libraryCirculationIds?: string[];
}

export interface GenerateInvoicesPayload {
  year: number;
  month: number;
  batchId?: string | null;
  dueDate: string;
  billingCycle?: number; // 1=Monthly, 3=Quarterly, 6=HalfYearly, 12=Yearly
}

export interface GenerateInvoicesResult {
  generatedCount: number;
  skippedCount: number;
  message: string;
}

export interface FeeReceiptLineItem {
  itemIndex: number;
  particulars: string;
  subTitle?: string;
  reference?: string;
  amount: number;
}

export interface FeePaymentReceipt {
  paymentId: string;
  receiptNumber: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentName: string;
  parentPhone: string;
  invoiceNumber: string;
  amountPaid: number;
  remainingDue: number;
  paymentDate: string;
  mode: number | string;
  transactionRef?: string;
  remarks?: string;
  tuitionAmountPaid?: number;
  libraryFineAmountPaid?: number;
  libraryFineParticulars?: string;
  pendingLibraryFine?: number;
  items?: FeeReceiptLineItem[];
}

export interface StudentPendingFineItem {
  circulationId: string;
  accessionNumber: string;
  bookTitle: string;
  overdueDays: number;
  fineAmount: number;
  dueDate: string;
  returnDate?: string;
}

export interface StudentLibraryDues {
  studentId: string;
  pendingFineAmount: number;
  pendingFinesCount: number;
  pendingFines: StudentPendingFineItem[];
  activeOverdueBooksCount: number;
}

export interface FeeDueSlipItem {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  breakdown?: FeeInvoiceItem[];
}

export interface FeeDueSlip {
  studentId: string;
  studentName: string;
  rollNumber: string;
  batchName: string;
  parentName: string;
  parentPhone: string;
  totalOutstandingDue: number;
  generatedDate: string;
  dueItems: FeeDueSlipItem[];
  pendingLibraryFine?: number;
  activeOverdueBooksCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FeesService {
  private apiUrl = 'http://localhost:5000/api/fees';

  constructor(private http: HttpClient) {}

  getInvoicesPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    batchId: string = '',
    status: string = '',
    sortBy: string = 'dueDate',
    sortDescending: boolean = true
  ): Observable<PagedResult<FeeInvoicePagedItem>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortDescending', sortDescending.toString());

    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (batchId) params = params.set('batchId', batchId);
    if (status) params = params.set('status', status);
    if (sortBy) params = params.set('sortBy', sortBy);

    return this.http.get<PagedResult<FeeInvoicePagedItem>>(`${this.apiUrl}/invoices/paged`, { params });
  }

  getStudentLedger(studentId: string): Observable<StudentLedger> {
    return this.http.get<StudentLedger>(`${this.apiUrl}/student-ledger/${studentId}`);
  }

  getStudentLibraryDues(studentId: string): Observable<StudentLibraryDues> {
    return this.http.get<StudentLibraryDues>(`${this.apiUrl}/student/${studentId}/library-dues`);
  }

  collectFeeFifo(payload: CollectFifoFeePayload): Observable<FeePaymentReceipt> {
    return this.http.post<FeePaymentReceipt>(`${this.apiUrl}/collect-fifo`, payload);
  }

  getReceiptByNumber(receiptNumber: string): Observable<FeePaymentReceipt> {
    return this.http.get<FeePaymentReceipt>(`${this.apiUrl}/receipt/${receiptNumber}`);
  }

  getStudentDueSlip(studentId: string, invoiceId?: string): Observable<FeeDueSlip> {
    let params = new HttpParams();
    if (invoiceId) params = params.set('invoiceId', invoiceId);
    return this.http.get<FeeDueSlip>(`${this.apiUrl}/due-slip/${studentId}`, { params });
  }

  sendWhatsAppReminder(invoiceId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/send-reminder/${invoiceId}`, {});
  }

  generateMonthlyInvoices(payload: GenerateInvoicesPayload): Observable<GenerateInvoicesResult> {
    return this.http.post<GenerateInvoicesResult>(`${this.apiUrl}/generate-monthly-invoices`, payload);
  }

  cancelInvoice(invoiceId: string, reason: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel-invoice/${invoiceId}`, { reason });
  }

  private _refreshRequired$ = new Subject<void>();
  public refreshRequired$ = this._refreshRequired$.asObservable();

  notifyRefreshRequired(): void {
    this._refreshRequired$.next();
  }

  reversePayment(paymentId: string, reason: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/payment/${paymentId}`, {
      body: { reason }
    });
  }

  getFeeHeads(activeOnly: boolean = true): Observable<FeeHead[]> {
    return this.http.get<FeeHead[]>(`${this.apiUrl}/heads?activeOnly=${activeOnly}`);
  }

  getFeeHeadsPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm?: string,
    category?: string,
    frequency?: string,
    isActive?: boolean,
    sortBy: string = 'sortOrder',
    sortDescending: boolean = false
  ): Observable<PagedFeeHeadResult> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortBy', sortBy)
      .set('sortDescending', sortDescending.toString());

    if (searchTerm && searchTerm.trim()) params = params.set('searchTerm', searchTerm.trim());
    if (category && category !== 'All') params = params.set('category', category);
    if (frequency && frequency !== 'All') params = params.set('frequency', frequency);
    if (isActive !== undefined && isActive !== null) params = params.set('isActive', isActive.toString());

    return this.http.get<PagedFeeHeadResult>(`${this.apiUrl}/heads/paged`, { params });
  }

  saveFeeHead(payload: CreateFeeHeadPayload): Observable<FeeHead> {
    return this.http.post<FeeHead>(`${this.apiUrl}/heads`, payload);
  }

  updateFeeHead(id: string, payload: UpdateFeeHeadPayload): Observable<FeeHead> {
    return this.http.put<FeeHead>(`${this.apiUrl}/heads/${id}`, payload);
  }

  toggleFeeHeadStatus(id: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/heads/${id}/toggle-status`, {});
  }

  deleteFeeHead(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/heads/${id}`);
  }

  getClassFeeStructures(classId?: string, batchId?: string): Observable<ClassFeeStructureItem[]> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    if (batchId) params = params.set('batchId', batchId);
    return this.http.get<ClassFeeStructureItem[]>(`${this.apiUrl}/structures`, { params });
  }

  saveClassFeeStructures(payload: SaveClassFeeStructureBatch): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/structures`, payload);
  }
}
