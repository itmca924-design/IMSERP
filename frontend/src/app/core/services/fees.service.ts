import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  applicableTo?: string;
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
  applicableTo?: string;
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
  applicableTo?: string;
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
  applicableTo?: string;
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
  className?: string | null;
  sectionName?: string | null;
  currentClassName?: string | null;
  currentSectionName?: string | null;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
  branchName?: string;
  invoiceCategory?: string | null;
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
  isReversed?: boolean;
  reversedAt?: string;
  reversedBy?: string;
  reversalReason?: string;
  reversalType?: string; // 'ClericalCorrection' | 'RefundToParent'
  refundMode?: string;
  refundRecipient?: string;
  refundReference?: string;
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
  branchName?: string;
  reversedPayments?: StudentLedgerPaymentItem[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface FeeItemPayment {
  itemId: string;
  amount: number;
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
  itemPayments?: FeeItemPayment[];
}

export interface StudentCycleOverridePayload {
  studentId: string;
  billingCycle: number; // 1, 3, 6, 12
  startMonth?: number;
  startYear?: number;
}

export interface GenerateInvoicesPayload {
  year: number;
  month: number;
  batchId?: string | null;
  classId?: string | null;
  studentId?: string | null;
  dueDate: string;
  billingCycle?: number; // 1=Monthly, 3=Quarterly, 6=HalfYearly, 12=Yearly
  studentCycleOverrides?: StudentCycleOverridePayload[];
  branchId?: string | null;
  autoBillNewAdmissionsFromDoj?: boolean;
}

export interface GenerateInvoicesResult {
  generatedCount: number;
  skippedCount: number;
  message: string;
}

export interface PendingInvoicingStudent {
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string | null;
  classId?: string | null;
  className?: string | null;
  batchId?: string | null;
  batchName?: string | null;
  joiningDate: string;
  estimatedMonthlyFee: number;
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
  hostelInfo?: string;
  branchName?: string;
  className?: string;
  sectionName?: string;
  instituteName?: string;
  instituteLogoUrl?: string;
  instituteContactPhone?: string;
  instituteAddress?: string;
  studentId?: string;
  invoiceId?: string;
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
  hostelInfo?: string;
  branchName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeesService {
  private apiUrl = `${environment.apiUrl}/fees`;

  constructor(private http: HttpClient) {}

  getInvoicesPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    batchId: string = '',
    classId: string = '',
    status: string = '',
    sortBy: string = 'createdAt',
    sortDescending: boolean = true
  ): Observable<PagedResult<FeeInvoicePagedItem>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortDescending', sortDescending.toString());

    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (batchId) params = params.set('batchId', batchId);
    if (classId) params = params.set('classId', classId);
    if (status) params = params.set('status', status);
    if (sortBy) params = params.set('sortBy', sortBy);

    return this.http.get<PagedResult<FeeInvoicePagedItem>>(`${this.apiUrl}/invoices/paged`, { params });
  }

  getStudentLedger(studentId: string): Observable<StudentLedger> {
    return this.http.get<StudentLedger>(`${this.apiUrl}/student-ledger/${studentId}`);
  }

  getMyLedger(): Observable<StudentLedger> {
    return this.http.get<StudentLedger>(`${this.apiUrl}/my-ledger`);
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

  getPendingInvoicingStudents(month?: number, year?: number, branchId?: string, newAdmissionsOnly?: boolean): Observable<PendingInvoicingStudent[]> {
    let params: any = {};
    if (month) params.month = month.toString();
    if (year) params.year = year.toString();
    if (branchId) params.branchId = branchId;
    if (newAdmissionsOnly !== undefined) params.newAdmissionsOnly = newAdmissionsOnly.toString();
    return this.http.get<PendingInvoicingStudent[]>(`${this.apiUrl}/pending-invoicing-students`, { params });
  }

  cancelInvoice(invoiceId: string, reason: string, partialAction?: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/cancel-invoice/${invoiceId}`, { reason, partialAction });
  }

  private _refreshRequired$ = new Subject<void>();
  public refreshRequired$ = this._refreshRequired$.asObservable();

  notifyRefreshRequired(): void {
    this._refreshRequired$.next();
  }

  reversePayment(
    paymentId: string,
    reason: string = 'Payment reversed by admin',
    reversalType: string = 'ClericalCorrection',
    refundMode: string = 'Cash',
    refundRecipient?: string,
    refundReference?: string
  ): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/payment/${paymentId}`, {
      body: {
        reason,
        reversalType,
        refundMode,
        refundRecipient,
        refundReference
      }
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

  addInvoiceItem(invoiceId: string, payload: { feeHeadId?: string; headName: string; amount: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/invoices/${invoiceId}/items`, payload);
  }

  deleteInvoiceItem(invoiceId: string, itemId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/invoices/${invoiceId}/items/${itemId}`);
  }

  updateInvoiceItems(invoiceId: string, items: { feeHeadId?: string; headName: string; amount: number }[]): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/invoices/${invoiceId}/items`, { items });
  }

  getStudentFeeCard(studentId: string, sessionStartYear?: number): Observable<StudentFeeCard> {
    let params = new HttpParams();
    if (sessionStartYear) params = params.set('sessionStartYear', sessionStartYear.toString());
    return this.http.get<StudentFeeCard>(`${this.apiUrl}/student-fee-card/${studentId}`, { params });
  }

  getStudentFeeCardsByClass(classId?: string, sectionId?: string, batchId?: string, sessionStartYear?: number): Observable<StudentFeeCard[]> {
    let params = new HttpParams();
    if (classId) params = params.set('classId', classId);
    if (sectionId) params = params.set('sectionId', sectionId);
    if (batchId) params = params.set('batchId', batchId);
    if (sessionStartYear) params = params.set('sessionStartYear', sessionStartYear.toString());
    return this.http.get<StudentFeeCard[]>(`${this.apiUrl}/student-fee-cards-by-class`, { params });
  }

  // ─── Dynamic Bharat UPI QR & Online Fee Collection Methods ───────────

  getInvoiceUpiIntent(invoiceId: string): Observable<UpiIntentResponse> {
    return this.http.get<UpiIntentResponse>(`${this.apiUrl}/invoices/${invoiceId}/upi-intent`);
  }

  collectInvoiceUpiPayment(invoiceId: string, payload: CollectUpiPaymentPayload): Observable<FeePaymentReceipt> {
    return this.http.post<FeePaymentReceipt>(`${this.apiUrl}/invoices/${invoiceId}/upi-collect`, payload);
  }

  collectStudentFifoUpiPayment(studentId: string, payload: CollectStudentFifoUpiPayload): Observable<FeePaymentReceipt> {
    return this.http.post<FeePaymentReceipt>(`${this.apiUrl}/student/${studentId}/upi-collect-fifo`, payload);
  }

  getUpiSettings(branchId?: string): Observable<UpiPaymentSettings> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<UpiPaymentSettings>(`${this.apiUrl}/upi-settings`, { params });
  }

  getUpiPaymentSettings(branchId?: string): Observable<UpiPaymentSettings> {
    return this.getUpiSettings(branchId);
  }

  updateUpiSettings(payload: UpdateUpiPaymentSettingsPayload): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/upi-settings`, payload);
  }

  getOnlineUpiTransactions(
    pageNumber: number = 1,
    pageSize: number = 15,
    searchTerm?: string,
    branchId?: string,
    fromDate?: string,
    toDate?: string
  ): Observable<{ items: OnlineUpiTransactionItem[]; totalCount: number; pageNumber: number; pageSize: number }> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm && searchTerm.trim()) params = params.set('searchTerm', searchTerm.trim());
    if (branchId) params = params.set('branchId', branchId);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);

    return this.http.get<{ items: OnlineUpiTransactionItem[]; totalCount: number; pageNumber: number; pageSize: number }>(
      `${this.apiUrl}/online-upi-transactions`,
      { params }
    );
  }

  // ── Fee Concessions & Sibling Discount Engine ──
  getConcessions(filters?: {
    search?: string;
    concessionType?: string;
    status?: string;
    branchId?: string;
  }): Observable<StudentFeeConcession[]> {
    let params = new HttpParams();
    if (filters?.search) params = params.set('search', filters.search.trim());
    if (filters?.concessionType) params = params.set('concessionType', filters.concessionType);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.branchId) params = params.set('branchId', filters.branchId);
    return this.http.get<StudentFeeConcession[]>(`${environment.apiUrl}/fees/concessions`, { params });
  }

  getConcessionStats(branchId?: string): Observable<FeeConcessionStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<FeeConcessionStats>(`${environment.apiUrl}/fees/concessions/stats`, { params });
  }

  createConcession(dto: CreateFeeConcessionDto): Observable<StudentFeeConcession> {
    return this.http.post<StudentFeeConcession>(`${environment.apiUrl}/fees/concessions`, dto);
  }

  updateConcessionStatus(id: string, dto: UpdateFeeConcessionStatusDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/fees/concessions/${id}/status`, dto);
  }

  deleteConcession(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${environment.apiUrl}/fees/concessions/${id}`);
  }
}

export interface StudentFeeConcession {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber?: string | null;
  classOrBatchName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  concessionType: string;
  title: string;
  discountMode: string;
  discountValue: number;
  feeHeadId?: string | null;
  feeHeadName?: string | null;
  applicableFrom: string;
  applicableTo?: string | null;
  status: string;
  approvedBy?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface CreateFeeConcessionDto {
  studentId: string;
  concessionType: string;
  title: string;
  discountMode: string;
  discountValue: number;
  feeHeadId?: string | null;
  applicableFrom?: string | null;
  applicableTo?: string | null;
  approvedBy?: string | null;
  remarks?: string | null;
}

export interface UpdateFeeConcessionStatusDto {
  status: string;
  remarks?: string | null;
}

export interface FeeConcessionStats {
  totalActiveConcessions: number;
  siblingDiscountsActive: number;
  meritScholarshipsActive: number;
  ewsRteActive: number;
  totalConcessionAmountBilled: number;
}

export interface UpiIntentResponse {
  invoiceId: string;
  invoiceNumber: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  payeeUpiId: string;
  payeeName: string;
  payeeMerchantCode?: string;
  upiIntentUri: string;
  gpayUri: string;
  phonepeUri: string;
  paytmUri: string;
  bhimUri: string;
  branchName?: string;
  instituteName: string;
  instituteLogo?: string;
}

export interface CollectUpiPaymentPayload {
  amount: number;
  upiRrn: string;
  payerVpa?: string;
  payerName?: string;
  payerPhone?: string;
  remarks?: string;
  sendWhatsAppReceipt?: boolean;
}

export interface CollectStudentFifoUpiPayload {
  studentId: string;
  amount: number;
  upiRrn: string;
  payerVpa?: string;
  payerName?: string;
  payerPhone?: string;
  remarks?: string;
  sendWhatsAppReceipt?: boolean;
  includeLibraryFine?: boolean;
}

export interface UpiPaymentSettings {
  upiId?: string;
  upiMerchantName?: string;
  upiMerchantCode?: string;
  upiQrEnabled: boolean;
  upiAutoVerify: boolean;
  branchUpiId?: string;
  branchUpiMerchantName?: string;
  effectiveUpiId: string;
  effectiveMerchantName: string;
  effectiveBankName?: string;
  effectiveAccountNumber?: string;
  effectiveIfsc?: string;
  effectiveHolder?: string;
  effectiveAccountType?: string;
  effectiveBranchLocation?: string;
}

export interface UpdateUpiPaymentSettingsPayload {
  upiId: string;
  upiMerchantName: string;
  upiMerchantCode?: string;
  upiQrEnabled: boolean;
  upiAutoVerify: boolean;
  applyToBranchOnly?: boolean;
  branchId?: string;
}

export interface OnlineUpiTransactionItem {
  paymentId: string;
  invoiceId: string;
  invoiceNumber: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  branchName?: string;
  amountPaid: number;
  upiRrn?: string;
  payerVpa?: string;
  payerName?: string;
  payerPhone?: string;
  onlinePaymentStatus?: string;
  paymentDate: string;
  verifiedBy?: string;
  verifiedAt?: string;
}


export interface FeeCardMonthEntry {
  monthIndex: number;
  monthName: string;
  monthShort: string;
  calendarMonth: number;
  calendarYear: number;
  status: 'Paid' | 'PartiallyPaid' | 'Due' | 'Overdue' | 'Upcoming' | string;
  amountPayable: number;
  concessionAmount: number;
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  invoiceNumber?: string | null;
  receiptNumber?: string | null;
  paymentDate?: string | null;
  paymentMode?: string | null;
  remarks?: string | null;
}

export interface StudentFeeCard {
  studentId: string;
  studentName: string;
  admissionNumber?: string | null;
  rollNumber?: string | null;
  className?: string | null;
  sectionName?: string | null;
  batchName?: string | null;
  gender?: string | null;
  joiningDate?: string | null;
  parentName?: string | null;
  motherName?: string | null;
  parentWhatsAppPhone?: string | null;
  emergencyContactPhone?: string | null;
  address?: string | null;
  profilePhoto?: string | null;
  monthlyFeeRate: number;
  sessionName: string;
  instituteName: string;
  instituteAddress?: string | null;
  institutePhone?: string | null;
  instituteEmail?: string | null;
  instituteLogo?: string | null;
  branchName?: string | null;
  months: FeeCardMonthEntry[];
  totalAnnualFee: number;
  totalConcession: number;
  totalPaid: number;
  totalBalanceDue: number;
  pendingLibraryFine: number;
  schoolRollNumber?: string | null;
  coachingRollNumber?: string | null;
  isSchoolStudent?: boolean;
  isCoachingStudent?: boolean;
}

