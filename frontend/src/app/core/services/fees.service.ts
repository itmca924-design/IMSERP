import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

export interface GenerateInvoicesPayload {
  year: number;
  month: number;
  batchId?: string | null;
  dueDate: string;
}

export interface GenerateInvoicesResult {
  generatedCount: number;
  skippedCount: number;
  message: string;
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
}

export interface FeeDueSlipItem {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
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
}
