import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RolePermissionDto {
  id: string;
  roleId: string;
  menuItemId: string;
  menuTitle: string;
  routeUrl?: string;
  icon?: string;
  module: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  userCount: number;
  permissions: RolePermissionDto[];
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  isActive: boolean;
  permissions?: RolePermissionDto[];
}

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private readonly BASE_URL = 'http://localhost:5000/api/roles';

  constructor(private http: HttpClient) {}

  getRoles(): Observable<RoleDto[]> {
    return this.http.get<RoleDto[]>(this.BASE_URL);
  }

  getRoleById(id: string): Observable<RoleDto> {
    return this.http.get<RoleDto>(`${this.BASE_URL}/${id}`);
  }

  createRole(role: CreateRoleDto): Observable<RoleDto> {
    return this.http.post<RoleDto>(this.BASE_URL, role);
  }

  updateRole(id: string, role: CreateRoleDto): Observable<RoleDto> {
    return this.http.put<RoleDto>(`${this.BASE_URL}/${id}`, role);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/${id}`);
  }
}
