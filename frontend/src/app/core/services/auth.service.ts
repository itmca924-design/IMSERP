import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

export interface BranchInfo {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  address?: string | null;
  contactPhone?: string | null;
  isMainBranch: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  tenantId: string;
  instituteName: string;
  tenantCode: string;
  profilePhoto?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  branches?: BranchInfo[] | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:5000/api/auth';
  
  currentUser = signal<LoginResponse | null>(this.getUserFromStorage());
  selectedBranchId = signal<string | null>(this.getStoredBranchId());
  private dialog = inject(MatDialog, { optional: true });

  constructor(private http: HttpClient, private router: Router) {}

  isRememberMe(): boolean {
    return localStorage.getItem('remember_me') === 'true';
  }

  getActiveStorage(): Storage {
    if (sessionStorage.getItem('auth_token')) {
      return sessionStorage;
    }
    if (this.isRememberMe() && localStorage.getItem('auth_token')) {
      return localStorage;
    }
    return sessionStorage;
  }

  private getStoredBranchId(): string | null {
    return sessionStorage.getItem('selected_branch_id') || localStorage.getItem('selected_branch_id');
  }

  getInstituteLogoUrl(): string | null {
    const photo = this.currentUser()?.profilePhoto;
    if (!photo) return null;
    if (photo.startsWith('/uploads/')) {
      return `http://localhost:5000${photo}`;
    }
    return photo;
  }

  login(credentials: { tenantCode: string; username: string; password: string }, rememberMe: boolean = false): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(res => {
        this.saveAuthData(res, rememberMe);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();
    const rememberMe = this.isRememberMe();
    return this.http.post<LoginResponse>(`${this.API_URL}/refresh-token`, { token, refreshToken }).pipe(
      tap(res => {
        this.saveAuthData(res, rememberMe);
      })
    );
  }

  private saveAuthData(res: LoginResponse, rememberMe: boolean = false): void {
    const targetStorage = rememberMe ? localStorage : sessionStorage;
    const alternateStorage = rememberMe ? sessionStorage : localStorage;

    // Remove auth keys from alternate storage to prevent conflicting states
    this.clearStorageAuth(alternateStorage);

    if (rememberMe) {
      localStorage.setItem('remember_me', 'true');
    } else {
      localStorage.removeItem('remember_me');
    }

    // Always keep last tenant code in localStorage for convenience
    if (res.tenantCode) {
      localStorage.setItem('last_tenant_code', res.tenantCode);
    }

    targetStorage.setItem('auth_token', res.token);
    if (res.refreshToken) {
      targetStorage.setItem('refresh_token', res.refreshToken);
    }
    if (res.tenantCode) {
      targetStorage.setItem('last_tenant_code', res.tenantCode);
    }
    if (res.userId) {
      targetStorage.setItem('userId', res.userId);
    }
    if (res.username) {
      targetStorage.setItem('userName', res.username);
    }
    if (res.fullName) {
      targetStorage.setItem('fullName', res.fullName);
    }
    if (res.role) {
      targetStorage.setItem('role', res.role);
    }
    if (res.tenantId) {
      targetStorage.setItem('tenantId', res.tenantId);
    }
    if (res.instituteName) {
      targetStorage.setItem('instituteName', res.instituteName);
    }
    if (res.branchId) {
      targetStorage.setItem('branchId', res.branchId);
    }
    if (res.branchName) {
      targetStorage.setItem('branchName', res.branchName);
    }
    targetStorage.setItem('user_info', JSON.stringify(res));

    // Update last activity timestamp
    localStorage.setItem('imserp_last_activity', Date.now().toString());

    this.currentUser.set(res);
  }

  updateLastActivity(): void {
    localStorage.setItem('imserp_last_activity', Date.now().toString());
  }

  checkSessionExpired(): boolean {
    const token = this.getToken();
    if (!token) return true;

    // Check last activity timestamp
    const lastActiveStr = localStorage.getItem('imserp_last_activity');
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      const elapsed = Date.now() - lastActive;

      // If Remember Me is OFF: 15 minutes of inactivity means session is expired
      if (!this.isRememberMe()) {
        if (elapsed > 15 * 60 * 1000) {
          return true;
        }
      } else {
        // If Remember Me is ON: 7 days of inactivity (matching refresh token)
        if (elapsed > 7 * 24 * 60 * 60 * 1000) {
          return true;
        }
      }
    } else if (!this.isRememberMe()) {
      // Legacy session without activity timestamp
      return true;
    }

    // Inspect JWT token expiration claim
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          const isExpired = Date.now() >= payload.exp * 1000;
          if (isExpired && !this.isRememberMe()) {
            return true;
          }
        }
      }
    } catch {
      return true;
    }

    return false;
  }

  updateTenantProfile(profilePhoto?: string | null, instituteName?: string | null, tenantCode?: string | null): void {
    const current = this.currentUser();
    if (!current) return;
    const updated: LoginResponse = {
      ...current,
      profilePhoto: profilePhoto !== undefined ? profilePhoto : current.profilePhoto,
      instituteName: instituteName || current.instituteName,
      tenantCode: tenantCode || current.tenantCode
    };
    const storage = this.getActiveStorage();
    if (updated.profilePhoto) {
      storage.setItem('profilePhoto', updated.profilePhoto);
    } else {
      storage.removeItem('profilePhoto');
    }
    if (updated.instituteName) {
      storage.setItem('instituteName', updated.instituteName);
    }
    storage.setItem('user_info', JSON.stringify(updated));
    this.currentUser.set(updated);
  }

  switchBranch(branchId: string | null): void {
    const storage = this.getActiveStorage();
    if (branchId) {
      storage.setItem('selected_branch_id', branchId);
    } else {
      storage.removeItem('selected_branch_id');
    }
    this.selectedBranchId.set(branchId);
  }

  private clearStorageAuth(storage: Storage): void {
    storage.removeItem('auth_token');
    storage.removeItem('refresh_token');
    storage.removeItem('user_info');
    storage.removeItem('selected_branch_id');
    storage.removeItem('userId');
    storage.removeItem('userName');
    storage.removeItem('fullName');
    storage.removeItem('role');
    storage.removeItem('tenantId');
    storage.removeItem('instituteName');
    storage.removeItem('branchId');
    storage.removeItem('branchName');
    storage.removeItem('accessToken');
    storage.removeItem('roles');
    storage.removeItem('email');
  }

  logout(reason?: string): void {
    // Immediately close any open modal dialogs or popups
    try {
      this.dialog?.closeAll();
    } catch (e) {
      console.warn('Could not close dialogs on logout:', e);
    }

    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API_URL}/revoke-token`, {}).subscribe({
        error: () => {} // Best effort revocation
      });
    }

    this.clearStorageAuth(localStorage);
    this.clearStorageAuth(sessionStorage);
    localStorage.removeItem('remember_me');
    localStorage.removeItem('imserp_last_activity');

    this.selectedBranchId.set(null);
    this.currentUser.set(null);

    if (reason) {
      this.router.navigate(['/login'], { queryParams: { reason } });
    } else {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    if (sessionStorage.getItem('auth_token')) {
      return sessionStorage.getItem('auth_token');
    }
    if (this.isRememberMe()) {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  getRefreshToken(): string | null {
    if (sessionStorage.getItem('refresh_token')) {
      return sessionStorage.getItem('refresh_token');
    }
    if (this.isRememberMe()) {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  getLastTenantCode(): string {
    return localStorage.getItem('last_tenant_code') || 'APEX';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private getUserFromStorage(): LoginResponse | null {
    const storage = this.getActiveStorage();
    const data = storage.getItem('user_info');
    if (!data) return null;
    try {
      const user: LoginResponse = JSON.parse(data);
      if (user && !user.userId && user.token) {
        const parts = user.token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          const id = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] || payload['nameid'] || payload['sub'];
          if (id) {
            user.userId = id;
            storage.setItem('user_info', JSON.stringify(user));
          }
        }
      }
      return user;
    } catch {
      return null;
    }
  }
}

