import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventoryDashboardStats,
  InventoryCategory,
  CreateUpdateCategoryDto,
  InventoryVendor,
  CreateUpdateVendorDto,
  InventoryItem,
  CreateUpdateItemDto,
  InventoryInward,
  CreateInwardDto,
  InventoryOutward,
  CreateOutwardDto,
  InventoryStockAdjustment,
  CreateStockAdjustmentDto,
  StudentLookupItem,
  StaffLookupItem,
  VendorLedgerSummary,
  RecordVendorPaymentDto,
  VendorPayment,
  InventoryPurchaseReturn,
  CreatePurchaseReturnDto,
  InventorySaleReturn,
  CreateSaleReturnDto
} from './inventory.models';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/inventory`;

  // Dashboard Metrics
  getDashboardStats(branchId?: string): Observable<InventoryDashboardStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventoryDashboardStats>(`${this.baseUrl}/dashboard`, { params });
  }

  // Categories
  getCategories(branchId?: string): Observable<InventoryCategory[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventoryCategory[]>(`${this.baseUrl}/categories`, { params });
  }

  createCategory(dto: CreateUpdateCategoryDto): Observable<InventoryCategory> {
    return this.http.post<InventoryCategory>(`${this.baseUrl}/categories`, dto);
  }

  updateCategory(id: string, dto: CreateUpdateCategoryDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/categories/${id}`, dto);
  }

  deleteCategory(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/categories/${id}`);
  }

  // Vendors
  getVendors(branchId?: string): Observable<InventoryVendor[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventoryVendor[]>(`${this.baseUrl}/vendors`, { params });
  }

  createVendor(dto: CreateUpdateVendorDto): Observable<InventoryVendor> {
    return this.http.post<InventoryVendor>(`${this.baseUrl}/vendors`, dto);
  }

  updateVendor(id: string, dto: CreateUpdateVendorDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/vendors/${id}`, dto);
  }

  deleteVendor(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/vendors/${id}`);
  }

  // Items Catalog
  getItems(filters: {
    search?: string;
    categoryId?: string;
    itemType?: string;
    lowStockOnly?: boolean;
    branchId?: string;
    activeOnly?: boolean;
  }): Observable<InventoryItem[]> {
    let params = new HttpParams();
    if (filters.search) params = params.set('search', filters.search);
    if (filters.categoryId) params = params.set('categoryId', filters.categoryId);
    if (filters.itemType && filters.itemType !== 'All') params = params.set('itemType', filters.itemType);
    if (filters.lowStockOnly !== undefined && filters.lowStockOnly !== null) params = params.set('lowStockOnly', filters.lowStockOnly.toString());
    if (filters.branchId) params = params.set('branchId', filters.branchId);
    if (filters.activeOnly !== undefined) params = params.set('activeOnly', filters.activeOnly.toString());

    return this.http.get<InventoryItem[]>(`${this.baseUrl}/items`, { params });
  }

  createItem(dto: CreateUpdateItemDto): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.baseUrl}/items`, dto);
  }

  updateItem(id: string, dto: CreateUpdateItemDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/items/${id}`, dto);
  }

  deleteItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/items/${id}`);
  }

  // Stock Inward
  getInwards(filters: {
    startDate?: string;
    endDate?: string;
    vendorId?: string;
    branchId?: string;
  }): Observable<InventoryInward[]> {
    let params = new HttpParams();
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.vendorId) params = params.set('vendorId', filters.vendorId);
    if (filters.branchId) params = params.set('branchId', filters.branchId);

    return this.http.get<InventoryInward[]>(`${this.baseUrl}/inwards`, { params });
  }

  createInward(dto: CreateInwardDto): Observable<{ message: string; inwardNumber: string }> {
    return this.http.post<{ message: string; inwardNumber: string }>(`${this.baseUrl}/inwards`, dto);
  }

  // Stock Outward / Issue & Sale
  getOutwards(filters: {
    startDate?: string;
    endDate?: string;
    issueType?: string;
    studentId?: string;
    branchId?: string;
  }): Observable<InventoryOutward[]> {
    let params = new HttpParams();
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.issueType && filters.issueType !== 'All') params = params.set('issueType', filters.issueType);
    if (filters.studentId) params = params.set('studentId', filters.studentId);
    if (filters.branchId) params = params.set('branchId', filters.branchId);

    return this.http.get<InventoryOutward[]>(`${this.baseUrl}/outwards`, { params });
  }

  createOutward(dto: CreateOutwardDto): Observable<{ message: string; issueNumber: string }> {
    return this.http.post<{ message: string; issueNumber: string }>(`${this.baseUrl}/outwards`, dto);
  }

  cancelOutward(id: string, reason?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/outwards/${id}/cancel`, { reason });
  }

  // Stock Adjustments
  getAdjustments(itemId?: string, branchId?: string): Observable<InventoryStockAdjustment[]> {
    let params = new HttpParams();
    if (itemId) params = params.set('itemId', itemId);
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventoryStockAdjustment[]>(`${this.baseUrl}/adjustments`, { params });
  }

  createAdjustment(dto: CreateStockAdjustmentDto): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/adjustments`, dto);
  }

  // Student Quick Lookup
  searchStudents(query?: string, branchId?: string, classId?: string): Observable<StudentLookupItem[]> {
    let params = new HttpParams();
    if (query) params = params.set('query', query);
    if (branchId) params = params.set('branchId', branchId);
    if (classId) params = params.set('classId', classId);
    return this.http.get<StudentLookupItem[]>(`${this.baseUrl}/students-lookup`, { params });
  }

  // Staff / Teacher / Employee Quick Lookup
  getStaffLookup(branchId?: string): Observable<StaffLookupItem[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<StaffLookupItem[]>(`${this.baseUrl}/staff-lookup`, { params });
  }

  // Vendor Ledger & Payments
  getVendorLedger(
    vendorId: string,
    optionsOrStartDate?: string | {
      startDate?: string;
      endDate?: string;
      search?: string;
      entryType?: string;
      paymentMode?: string;
      sortBy?: string;
      sortDirection?: string;
      pageNumber?: number;
      pageSize?: number;
      branchId?: string;
    },
    endDateParam?: string
  ): Observable<VendorLedgerSummary> {
    let params = new HttpParams();

    if (typeof optionsOrStartDate === 'string') {
      if (optionsOrStartDate) params = params.set('startDate', optionsOrStartDate);
      if (endDateParam) params = params.set('endDate', endDateParam);
    } else if (optionsOrStartDate) {
      const options = optionsOrStartDate;
      if (options.startDate) params = params.set('startDate', options.startDate);
      if (options.endDate) params = params.set('endDate', options.endDate);
      if (options.search) params = params.set('search', options.search);
      if (options.entryType && options.entryType !== 'ALL') params = params.set('entryType', options.entryType);
      if (options.paymentMode && options.paymentMode !== 'ALL') params = params.set('paymentMode', options.paymentMode);
      if (options.sortBy) params = params.set('sortBy', options.sortBy);
      if (options.sortDirection) params = params.set('sortDirection', options.sortDirection);
      if (options.pageNumber) params = params.set('pageNumber', options.pageNumber.toString());
      if (options.pageSize) params = params.set('pageSize', options.pageSize.toString());
      if (options.branchId) params = params.set('branchId', options.branchId);
    }

    return this.http.get<VendorLedgerSummary>(`${this.baseUrl}/vendors/${vendorId}/ledger`, { params });
  }

  recordVendorPayment(dto: RecordVendorPaymentDto): Observable<{ message: string; voucherNumber: string }> {
    return this.http.post<{ message: string; voucherNumber: string }>(`${this.baseUrl}/vendors/payments`, dto);
  }

  getVendorPayments(vendorId?: string, branchId?: string): Observable<VendorPayment[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', vendorId);
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<VendorPayment[]>(`${this.baseUrl}/vendors/payments`, { params });
  }

  // Purchase Returns (Debit Notes)
  getPurchaseReturns(vendorId?: string, branchId?: string): Observable<InventoryPurchaseReturn[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set('vendorId', vendorId);
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventoryPurchaseReturn[]>(`${this.baseUrl}/purchase-returns`, { params });
  }

  createPurchaseReturn(dto: CreatePurchaseReturnDto): Observable<{ message: string; returnNumber: string; debitNoteNumber: string }> {
    return this.http.post<{ message: string; returnNumber: string; debitNoteNumber: string }>(`${this.baseUrl}/purchase-returns`, dto);
  }

  // Sale Returns (Kit Return from Student/Staff)
  getSaleReturns(studentId?: string, branchId?: string): Observable<InventorySaleReturn[]> {
    let params = new HttpParams();
    if (studentId) params = params.set('studentId', studentId);
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InventorySaleReturn[]>(`${this.baseUrl}/sale-returns`, { params });
  }

  createSaleReturn(dto: CreateSaleReturnDto): Observable<{ message: string; returnNumber: string }> {
    return this.http.post<{ message: string; returnNumber: string }>(`${this.baseUrl}/sale-returns`, dto);
  }
}
