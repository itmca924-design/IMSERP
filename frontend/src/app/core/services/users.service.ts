import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface UserDto {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  roleName: string;
  roleId?: string;
  branchId?: string | null;
  branchName?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserDto {
  username: string;
  password?: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  roleId: string;
  branchId?: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly BASE_URL = 'http://localhost:5000/api/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<UserDto[]> {
    return this.http.get<UserDto[]>(this.BASE_URL);
  }

  getUsersPaged(
    pageNumber: number = 1,
    pageSize: number = 10,
    searchTerm: string = '',
    sortBy: string = 'username',
    sortDescending: boolean = false,
    isActive?: boolean | null,
    roleId?: string | null,
    branchId?: string | null
  ): Observable<PagedResult<UserDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString())
      .set('sortBy', sortBy)
      .set('sortDescending', sortDescending.toString());

    if (searchTerm && searchTerm.trim()) {
      params = params.set('searchTerm', searchTerm.trim());
    }

    if (isActive !== undefined && isActive !== null) {
      params = params.set('isActive', isActive.toString());
    }

    if (roleId && roleId.trim()) {
      params = params.set('roleId', roleId.trim());
    }

    if (branchId !== undefined && branchId !== null && branchId.trim()) {
      params = params.set('branchId', branchId.trim());
    }

    return this.http.get<PagedResult<UserDto>>(`${this.BASE_URL}/paged`, { params });
  }

  createUser(user: CreateUserDto): Observable<UserDto> {
    return this.http.post<UserDto>(this.BASE_URL, user);
  }

  updateUser(id: string, user: CreateUserDto): Observable<UserDto> {
    return this.http.put<UserDto>(`${this.BASE_URL}/${id}`, user);
  }

  deleteUser(id: string): Observable<any> {
    return this.http.delete(`${this.BASE_URL}/${id}`);
  }
}
