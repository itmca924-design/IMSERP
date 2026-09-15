import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
