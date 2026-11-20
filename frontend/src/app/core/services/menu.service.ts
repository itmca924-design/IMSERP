import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
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

  private cachedMyMenu: MenuItem[] | null = null;
  private cachedUserId: string | null = null;
  private cachedToken: string | null = null;

  private getStorageKey(): string {
    const tenantId = sessionStorage.getItem('tenantId') || localStorage.getItem('tenantId') || 'global';
    const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId') || 'anon';
    const role = sessionStorage.getItem('role') || localStorage.getItem('role') || 'norole';
    return `imserp_menu_cache_${tenantId}_${userId}_${role}`;
  }

  saveMenuToStorage(menu: MenuItem[]): void {
    try {
      if (menu && menu.length > 0) {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(menu));
      }
    } catch (e) {
      console.warn('[MenuService] Could not save menu cache to storage:', e);
    }
  }

  getMenuFromStorage(): MenuItem[] | null {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[MenuService] Could not parse menu cache from storage:', e);
    }
    return null;
  }

  clearCache(): void {
    this.cachedMyMenu = null;
    this.cachedUserId = null;
    this.cachedToken = null;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('imserp_menu_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }

  getMyMenu(forceRefresh: boolean = false): Observable<MenuItem[]> {
    const currentToken = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token') || null;
    const currentUserId = sessionStorage.getItem('userId') || localStorage.getItem('userId') || null;

    if (!forceRefresh && this.cachedMyMenu && this.cachedToken === currentToken && this.cachedUserId === currentUserId) {
      return of(this.cachedMyMenu);
    }
    return this.http.get<MenuItem[]>(`${this.BASE_URL}/my-menu`).pipe(
      tap(menu => {
        this.cachedMyMenu = menu;
        this.cachedToken = currentToken;
        this.cachedUserId = currentUserId;
      })
    );
  }

  hasRouteAccess(routeUrl: string, menuList?: MenuItem[]): boolean {
    const list = menuList || this.cachedMyMenu || [];
    const check = (items: MenuItem[]): boolean => {
      for (const item of items) {
        if (item.routeUrl && item.routeUrl.trim().toLowerCase() === routeUrl.trim().toLowerCase()) {
          return true;
        }
        if (item.children && item.children.length > 0 && check(item.children)) {
          return true;
        }
      }
      return false;
    };
    return check(list);
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
