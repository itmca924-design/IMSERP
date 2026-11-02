import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HolidayDto } from '../../features/teachers/teacher.models';
import { environment } from '../../../environments/environment';

export interface MenuItem {
  id: string;
  title: string;
  routeUrl?: string;
  icon?: string;
  parentId?: string;
  sortOrder: number;
  module: string;
  isActive: boolean;
  children: MenuItem[];
}

export interface ManagedMenuItem {
  id: string;
  title: string;
  routeUrl?: string | null;
  icon?: string | null;
  parentId?: string | null;
  parentTitle?: string | null;
  level: number;
  sortOrder: number;
  module: string;
  isActive: boolean;
  tenantId: string | null;
  branchId: string | null;
  canEdit: boolean;
  canDelete: boolean;
}

export interface ManagedMenuOption {
  id: string;
  title: string;
  parentId?: string | null;
  module: string;
  isActive: boolean;
  canManage: boolean;
}

export interface SaveMenuItem {
  title: string;
  routeUrl: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  module: string;
  isActive: boolean;
}

export interface PagedMenuItems {
  items: ManagedMenuItem[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

export interface MenuManagementPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private readonly BASE_URL = `${environment.apiUrl}/menu`;

  constructor(private http: HttpClient) {}

  getMyMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.BASE_URL}/my-menu`);
  }

  getAllMenuItems(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.BASE_URL}/all`);
  }

  getManagedMenuItems(filters: {
    pageNumber: number;
    pageSize: number;
    searchTerm: string;
    module: string;
    status: string;
    parentId: string;
    sortBy: string;
    sortDescending: boolean;
  }): Observable<PagedMenuItems> {
    let params = new HttpParams()
      .set('pageNumber', filters.pageNumber)
      .set('pageSize', filters.pageSize)
      .set('sortBy', filters.sortBy)
      .set('sortDescending', filters.sortDescending);
    if (filters.searchTerm) params = params.set('searchTerm', filters.searchTerm);
    if (filters.module) params = params.set('module', filters.module);
    if (filters.status) params = params.set('isActive', filters.status === 'active');
    if (filters.parentId) params = params.set('parentId', filters.parentId);
    return this.http.get<PagedMenuItems>(`${this.BASE_URL}/manage`, { params });
  }

  getMenuOptions(): Observable<ManagedMenuOption[]> {
    return this.http.get<ManagedMenuOption[]>(`${this.BASE_URL}/manage/options`);
  }

  getManagedMenuItem(id: string): Observable<ManagedMenuItem> {
    return this.http.get<ManagedMenuItem>(`${this.BASE_URL}/manage/${id}`);
  }

  getMenuManagementPermissions(): Observable<MenuManagementPermissions> {
    return this.http.get<MenuManagementPermissions>(`${this.BASE_URL}/manage/permissions`);
  }

  createMenuItem(request: SaveMenuItem): Observable<ManagedMenuItem> {
    return this.http.post<ManagedMenuItem>(`${this.BASE_URL}/manage`, request);
  }

  updateMenuItem(id: string, request: SaveMenuItem): Observable<ManagedMenuItem> {
    return this.http.put<ManagedMenuItem>(`${this.BASE_URL}/manage/${id}`, request);
  }

  deactivateMenuItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.BASE_URL}/manage/${id}`);
  }

  getHolidayCalendar(year: number, month: number): Observable<HolidayDto[]> {
    return this.http.get<HolidayDto[]>(`${environment.apiUrl}/holidays`, {
      params: { year, month, activeOnly: true }
    });
  }
}
