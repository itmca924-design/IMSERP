import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

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
  selectedBranchId = signal<string | null>(localStorage.getItem('selected_branch_id'));

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: { tenantCode: string; username: string; password: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(res => {
        this.saveAuthData(res);
      })
    );
  }

  refreshToken(): Observable<LoginResponse> {
    const token = this.getToken();
    const refreshToken = this.getRefreshToken();
    return this.http.post<LoginResponse>(`${this.API_URL}/refresh-token`, { token, refreshToken }).pipe(
      tap(res => {
        this.saveAuthData(res);
      })
    );
  }

  private saveAuthData(res: LoginResponse): void {
    localStorage.setItem('auth_token', res.token);
    if (res.refreshToken) {
      localStorage.setItem('refresh_token', res.refreshToken);
    }
    if (res.tenantCode) {
      localStorage.setItem('last_tenant_code', res.tenantCode);
    }
    if (res.userId) {
      localStorage.setItem('userId', res.userId);
    }
    if (res.username) {
      localStorage.setItem('userName', res.username);
    }
    if (res.fullName) {
      localStorage.setItem('fullName', res.fullName);
    }
    if (res.role) {
      localStorage.setItem('role', res.role);
    }
    if (res.tenantId) {
      localStorage.setItem('tenantId', res.tenantId);
    }
    if (res.instituteName) {
      localStorage.setItem('instituteName', res.instituteName);
    }
    if (res.branchId) {
      localStorage.setItem('branchId', res.branchId);
    }
    if (res.branchName) {
      localStorage.setItem('branchName', res.branchName);
    }
    localStorage.setItem('user_info', JSON.stringify(res));

    // Clean up any stale dummy/mock keys from previous templates or apps on localhost:4200
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('roles');
    localStorage.removeItem('email');

    this.currentUser.set(res);
  }

  switchBranch(branchId: string | null): void {
    if (branchId) {
      localStorage.setItem('selected_branch_id', branchId);
    } else {
      localStorage.removeItem('selected_branch_id');
    }
    this.selectedBranchId.set(branchId);
  }

  logout(reason?: string): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API_URL}/revoke-token`, {}).subscribe({
        error: () => {} // Best effort revocation
      });
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    localStorage.removeItem('selected_branch_id');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('fullName');
    localStorage.removeItem('role');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('instituteName');
    localStorage.removeItem('branchId');
    localStorage.removeItem('branchName');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('roles');
    localStorage.removeItem('email');
    this.selectedBranchId.set(null);
    this.currentUser.set(null);
    if (reason) {
      this.router.navigate(['/login'], { queryParams: { reason } });
    } else {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  getLastTenantCode(): string {
    return localStorage.getItem('last_tenant_code') || 'APEX';
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private getUserFromStorage(): LoginResponse | null {
    const data = localStorage.getItem('user_info');
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
            localStorage.setItem('user_info', JSON.stringify(user));
          }
        }
      }
      if (user?.userId) {
        localStorage.setItem('userId', user.userId);
      }
      if (user?.username) {
        localStorage.setItem('userName', user.username);
      }
      if (user?.fullName) {
        localStorage.setItem('fullName', user.fullName);
      }
      if (user?.role) {
        localStorage.setItem('role', user.role);
      }
      if (user?.tenantId) {
        localStorage.setItem('tenantId', user.tenantId);
      }
      if (user?.instituteName) {
        localStorage.setItem('instituteName', user.instituteName);
      }
      if (user?.branchId) {
        localStorage.setItem('branchId', user.branchId);
      }
      if (user?.branchName) {
        localStorage.setItem('branchName', user.branchName);
      }

      // Clean obsolete legacy keys from other apps
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('roles');
      localStorage.removeItem('email');
      return user;
    } catch {
      return null;
    }
  }
}

