import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE, HolidayDto } from '../../features/teachers/teacher.models';

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

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  private readonly BASE_URL = 'http://localhost:5000/api/menu';

  constructor(private http: HttpClient) {}

  getMyMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.BASE_URL}/my-menu`);
  }

  getAllMenuItems(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${this.BASE_URL}/all`);
  }

  getHolidayCalendar(year: number, month: number): Observable<HolidayDto[]> {
    return this.http.get<HolidayDto[]>(`${API_BASE}/holidays`, {
      params: { year, month, activeOnly: true }
    });
  }
}
