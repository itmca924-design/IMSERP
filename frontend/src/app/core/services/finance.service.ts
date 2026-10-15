import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;

export enum AccountType {
  Asset = 1,
  Liability = 2,
  Equity = 3,
  Income = 4,
  Expense = 5
}

export enum AccountSubType {
  CurrentAsset = 1,
  FixedAsset = 2,
  CurrentLiability = 3,
  LongTermLiability = 4,
  Capital = 5
}

export enum ExpensePaymentMode {
  Cash = 1,
  UPI = 2,
  BankTransfer = 3,
  Cheque = 4,
  Card = 5
}

export interface ExpenseCategoryDto {
  id: string;
  tenantId: string;
  branchId?: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  voucherCount: number;
  totalSpent: number;
}

export interface CreateExpenseCategoryDto {
  name: string;
  code: string;
  description?: string;
  branchId?: string | null;
  sortOrder?: number;
}

export interface ExpenseVoucherDto {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  voucherNo: string;
  expenseDate: string;
  expenseCategoryId: string;
  categoryName: string;
  categoryCode: string;
  title: string;
  amount: number;
  paymentMode: ExpensePaymentMode;
  vendorName?: string;
  billInvoiceNo?: string;
  description?: string;
  receiptAttachmentUrl?: string;
  createdByUserId?: string;
  createdByUserName?: string;
  createdAt: string;
}

export interface CreateExpenseVoucherDto {
  expenseDate: string;
  expenseCategoryId: string;
  title: string;
  amount: number;
  paymentMode: ExpensePaymentMode;
  vendorName?: string;
  billInvoiceNo?: string;
  description?: string;
  receiptAttachmentUrl?: string;
  branchId?: string | null;
}

export interface UpdateExpenseVoucherDto {
  expenseDate: string;
  expenseCategoryId: string;
  title: string;
  amount: number;
  paymentMode: ExpensePaymentMode;
  vendorName?: string;
  billInvoiceNo?: string;
  description?: string;
  receiptAttachmentUrl?: string;
  branchId?: string | null;
}

export interface AccountLedgerDto {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  subType: AccountSubType;
  openingBalance: number;
  currentBalance: number;
  description?: string;
  isActive: boolean;
  isDefault: boolean;
}

export interface CreateAccountLedgerDto {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  subType: AccountSubType;
  openingBalance: number;
  description?: string;
  branchId?: string | null;
}

export interface UpdateAccountLedgerDto {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  subType: AccountSubType;
  openingBalance: number;
  description?: string;
  isActive: boolean;
}

export interface IncomeHeadSummaryDto {
  category: string;
  headName: string;
  amount: number;
  percentageOfTotal: number;
  division?: string;
}

export interface ExpenseHeadSummaryDto {
  category: string;
  headName: string;
  amount: number;
  percentageOfTotal: number;
  isPayroll: boolean;
}

export interface MonthlySurplusTrendDto {
  monthName: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpense: number;
  netSurplus: number;
  realizedCollections?: number;
}

export interface ProfitLossReportDto {
  fromDate: string;
  toDate: string;
  financialYear: string;
  branchId?: string;
  branchName: string;
  totalDirectIncome: number;
  totalPayrollExpense: number;
  totalOperatingExpense: number;
  totalExpense: number;
  netProfitOrLoss: number;
  profitMarginPercentage: number;
  isSurplus: boolean;
  incomes: IncomeHeadSummaryDto[];
  expenses: ExpenseHeadSummaryDto[];
  monthlyTrends: MonthlySurplusTrendDto[];
  academicScope?: string;
  realizedCashCollections?: number;
  accruedFeeReceivables?: number;
  libraryFinesIncome?: number;
}

export interface BalanceSheetItemDto {
  code: string;
  title: string;
  amount: number;
  category: string;
  isDynamic: boolean;
  note?: string;
}

export interface BalanceSheetGroupDto {
  groupName: string;
  totalAmount: number;
  items: BalanceSheetItemDto[];
}

export interface BalanceSheetReportDto {
  asOfDate: string;
  branchId?: string;
  branchName: string;
  currentAssets: BalanceSheetGroupDto;
  fixedAssets: BalanceSheetGroupDto;
  totalAssets: number;
  currentLiabilities: BalanceSheetGroupDto;
  longTermLiabilities: BalanceSheetGroupDto;
  equityAndCapital: BalanceSheetGroupDto;
  totalLiabilitiesAndEquity: number;
  difference: number;
  isBalanced: boolean;
  currentPeriodProfit: number;
  academicScope?: string;
  realizedCashBalance?: number;
  accountsReceivableTotal?: number;
  staffAdvancesTotal?: number;
}

export interface FinanceDashboardKpiDto {
  totalIncomeThisMonth: number;
  totalExpenseThisMonth: number;
  netSurplusThisMonth: number;
  totalFeeDuesOutstanding: number;
  cashInHandBalance: number;
  bankAccountsBalance: number;
  currentFinancialYearRevenue: number;
  currentFinancialYearExpense: number;
  currentFinancialYearSurplus: number;
}

export interface PagedResultDto<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages?: number;
}

export interface PagedExpenseResultDto {
  items: ExpenseVoucherDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalFilteredAmount: number;
  totalCashAmount: number;
  totalBankAmount: number;
}

export interface PagedLedgerResultDto {
  items: AccountLedgerDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalFilteredBalance: number;
  totalAssetsValuation: number;
  totalLiabilitiesValuation: number;
  totalEquityValuation: number;
  assetCount: number;
  liabilityCount: number;
  equityCount: number;
}

export interface DayBookTransactionDto {
  id: string;
  timestamp: string;
  voucherNumber: string;
  voucherType: 'Receipt' | 'Payment';
  accountHead: string;
  particulars: string;
  division: string;
  paymentMode: string;
  referenceNumber?: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  payeeOrPayerName?: string;
  remarks?: string;
  createdBy?: string;
}

export interface DayBookReportDto {
  date: string;
  fromDate?: string;
  toDate?: string;
  branchId?: string;
  branchName: string;
  openingBalance: number;
  totalInflow: number;
  totalOutflow: number;
  netDailyChange: number;
  closingBalance: number;
  cashInflow: number;
  bankInflow: number;
  cashOutflow: number;
  bankOutflow: number;
  totalTransactions: number;
  receiptCount: number;
  paymentCount: number;
  transactions: DayBookTransactionDto[];
  academicScope: string;
  pageNumber?: number;
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
}

@Injectable({
  providedIn: 'root'
})
export class FinanceService {
  private apiUrl = `${API_BASE}/finance`;

  constructor(private http: HttpClient) {}

  // 1. Profit & Loss
  getProfitLoss(params?: { fromDate?: string; toDate?: string; financialYear?: string; branchId?: string; academicScope?: string }): Observable<ProfitLossReportDto> {
    let httpParams = new HttpParams();
    if (params?.financialYear) httpParams = httpParams.set('financialYear', params.financialYear);
    if (params?.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params?.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params?.academicScope) httpParams = httpParams.set('academicScope', params.academicScope);
    return this.http.get<ProfitLossReportDto>(`${this.apiUrl}/profit-loss`, { params: httpParams });
  }

  // 2. Balance Sheet
  getBalanceSheet(params?: { asOfDate?: string; branchId?: string; academicScope?: string }): Observable<BalanceSheetReportDto> {
    let httpParams = new HttpParams();
    if (params?.asOfDate) httpParams = httpParams.set('asOfDate', params.asOfDate);
    if (params?.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params?.academicScope) httpParams = httpParams.set('academicScope', params.academicScope);
    return this.http.get<BalanceSheetReportDto>(`${this.apiUrl}/balance-sheet`, { params: httpParams });
  }

  // 3. Expenses Vouchers
  getExpensesPaged(params: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    categoryId?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    paymentMode?: ExpensePaymentMode | null;
    sortBy?: string;
    sortDescending?: boolean;
  }): Observable<PagedExpenseResultDto> {
    let httpParams = new HttpParams()
      .set('pageNumber', (params.pageNumber || 1).toString())
      .set('pageSize', (params.pageSize || 15).toString());

    if (params.searchTerm) httpParams = httpParams.set('searchTerm', params.searchTerm);
    if (params.categoryId) httpParams = httpParams.set('categoryId', params.categoryId);
    if (params.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params.paymentMode != null) httpParams = httpParams.set('paymentMode', params.paymentMode.toString());
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDescending !== undefined) httpParams = httpParams.set('sortDescending', params.sortDescending.toString());

    return this.http.get<PagedExpenseResultDto>(`${this.apiUrl}/expenses/paged`, { params: httpParams });
  }

  getExpenseById(id: string): Observable<ExpenseVoucherDto> {
    return this.http.get<ExpenseVoucherDto>(`${this.apiUrl}/expenses/${id}`);
  }

  createExpense(dto: CreateExpenseVoucherDto): Observable<ExpenseVoucherDto> {
    return this.http.post<ExpenseVoucherDto>(`${this.apiUrl}/expenses`, dto);
  }

  updateExpense(id: string, dto: UpdateExpenseVoucherDto): Observable<ExpenseVoucherDto> {
    return this.http.put<ExpenseVoucherDto>(`${this.apiUrl}/expenses/${id}`, dto);
  }

  deleteExpense(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/expenses/${id}`);
  }

  // 4. Categories
  getExpenseCategories(): Observable<ExpenseCategoryDto[]> {
    return this.http.get<ExpenseCategoryDto[]>(`${this.apiUrl}/expense-categories`);
  }

  createExpenseCategory(dto: CreateExpenseCategoryDto): Observable<ExpenseCategoryDto> {
    return this.http.post<ExpenseCategoryDto>(`${this.apiUrl}/expense-categories`, dto);
  }

  // 5. Chart of Accounts Ledgers
  getAccountLedgersPaged(params: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    accountType?: AccountType | null;
    subType?: AccountSubType | null;
    branchId?: string;
    sortBy?: string;
    sortDescending?: boolean;
  }): Observable<PagedLedgerResultDto> {
    let httpParams = new HttpParams()
      .set('pageNumber', (params.pageNumber || 1).toString())
      .set('pageSize', (params.pageSize || 15).toString());

    if (params.searchTerm) httpParams = httpParams.set('searchTerm', params.searchTerm);
    if (params.accountType != null) httpParams = httpParams.set('accountType', params.accountType.toString());
    if (params.subType != null) httpParams = httpParams.set('subType', params.subType.toString());
    if (params.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params.sortDescending !== undefined) httpParams = httpParams.set('sortDescending', params.sortDescending.toString());

    return this.http.get<PagedLedgerResultDto>(`${this.apiUrl}/ledgers/paged`, { params: httpParams });
  }

  getAccountLedgers(params?: { type?: number; subtype?: number }): Observable<AccountLedgerDto[]> {
    let httpParams = new HttpParams();
    if (params?.type) httpParams = httpParams.set('type', params.type.toString());
    if (params?.subtype) httpParams = httpParams.set('subtype', params.subtype.toString());
    return this.http.get<AccountLedgerDto[]>(`${this.apiUrl}/ledgers`, { params: httpParams });
  }

  createAccountLedger(dto: CreateAccountLedgerDto): Observable<AccountLedgerDto> {
    return this.http.post<AccountLedgerDto>(`${this.apiUrl}/ledgers`, dto);
  }

  updateAccountLedger(id: string, dto: UpdateAccountLedgerDto): Observable<AccountLedgerDto> {
    return this.http.put<AccountLedgerDto>(`${this.apiUrl}/ledgers/${id}`, dto);
  }

  deleteAccountLedger(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/ledgers/${id}`);
  }

  // 6. Summary KPI
  getFinanceSummary(branchId?: string): Observable<FinanceDashboardKpiDto> {
    let httpParams = new HttpParams();
    if (branchId) httpParams = httpParams.set('branchId', branchId);
    return this.http.get<FinanceDashboardKpiDto>(`${this.apiUrl}/summary`, { params: httpParams });
  }

  // 7. Day Book (दैनिक रोकड़ / रोजनामचा बही)
  getDayBook(params?: {
    date?: string;
    fromDate?: string;
    toDate?: string;
    branchId?: string;
    voucherType?: string;
    paymentMode?: string;
    academicScope?: string;
    searchTerm?: string;
    sortBy?: string;
    sortDescending?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<DayBookReportDto> {
    let httpParams = new HttpParams();
    if (params?.date) httpParams = httpParams.set('date', params.date);
    if (params?.fromDate) httpParams = httpParams.set('fromDate', params.fromDate);
    if (params?.toDate) httpParams = httpParams.set('toDate', params.toDate);
    if (params?.branchId) httpParams = httpParams.set('branchId', params.branchId);
    if (params?.voucherType) httpParams = httpParams.set('voucherType', params.voucherType);
    if (params?.paymentMode) httpParams = httpParams.set('paymentMode', params.paymentMode);
    if (params?.academicScope) httpParams = httpParams.set('academicScope', params.academicScope);
    if (params?.searchTerm) httpParams = httpParams.set('searchTerm', params.searchTerm);
    if (params?.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params?.sortDescending !== undefined) httpParams = httpParams.set('sortDescending', params.sortDescending.toString());
    if (params?.pageNumber !== undefined) httpParams = httpParams.set('pageNumber', params.pageNumber.toString());
    if (params?.pageSize !== undefined) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    return this.http.get<DayBookReportDto>(`${this.apiUrl}/daybook`, { params: httpParams });
  }
}
