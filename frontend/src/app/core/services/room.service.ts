import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RoomDto {
  id: string;
  tenantId: string;
  branchId: string;
  branchName?: string;
  roomNumber: string;
  capacity: number;
  floor?: string | null;
  isActive: boolean;
  createdAt: string;
  activeBatchCount: number;
}

export interface CreateRoomDto {
  branchId: string;
  roomNumber: string;
  capacity: number;
  floor?: string | null;
}

export interface UpdateRoomDto {
  roomNumber: string;
  capacity: number;
  floor?: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RoomService {
  private readonly API_URL = 'http://localhost:5000/api/rooms';

  constructor(private http: HttpClient) {}

  getRooms(branchId?: string | null): Observable<RoomDto[]> {
    let params = new HttpParams();
    if (branchId) {
      params = params.set('branchId', branchId);
    }
    return this.http.get<RoomDto[]>(this.API_URL, { params });
  }

  getRoomById(id: string): Observable<RoomDto> {
    return this.http.get<RoomDto>(`${this.API_URL}/${id}`);
  }

  createRoom(dto: CreateRoomDto): Observable<RoomDto> {
    return this.http.post<RoomDto>(this.API_URL, dto);
  }

  updateRoom(id: string, dto: UpdateRoomDto): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.API_URL}/${id}`, dto);
  }

  toggleRoomStatus(id: string): Observable<{ message: string; isActive: boolean }> {
    return this.http.patch<{ message: string; isActive: boolean }>(`${this.API_URL}/${id}/toggle-status`, {});
  }

  deleteRoom(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`);
  }
}
