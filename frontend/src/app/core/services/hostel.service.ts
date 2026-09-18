import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

export interface HostelDto {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  name: string;
  hostelType: string;
  address?: string;
  wardenName?: string;
  wardenPhone?: string;
  totalFloors: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateHostelDto {
  name: string;
  hostelType: string;
  address?: string;
  wardenName?: string;
  wardenPhone?: string;
  totalFloors?: number;
  branchId?: string;
}

export interface HostelRoomDto {
  id: string;
  tenantId: string;
  branchId?: string;
  hostelId: string;
  hostelName: string;
  roomNumber: string;
  floor: string;
  roomType: string;
  capacity: number;
  monthlyRent: number;
  hasAC: boolean;
  hasAttachedBath: boolean;
  amenities?: string;
  status: string;
  bedCount: number;
  occupiedBedCount: number;
  beds: HostelBedDto[];
}

export interface CreateHostelRoomDto {
  hostelId: string;
  roomNumber: string;
  floor?: string;
  roomType?: string;
  capacity: number;
  monthlyRent: number;
  hasAC?: boolean;
  hasAttachedBath?: boolean;
  amenities?: string;
  autoGenerateBeds?: boolean;
}

export interface HostelBedDto {
  id: string;
  roomId: string;
  roomNumber: string;
  hostelId: string;
  hostelName: string;
  bedCode: string;
  status: string;
  monthlyRent: number;
  currentStudentId?: string;
  studentName?: string;
  rollNumber?: string;
  parentPhone?: string;
  classOrBatch?: string;
  profilePhoto?: string;
}

export interface HostelAllocationDto {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  parentWhatsAppPhone?: string;
  classOrBatch?: string;
  bedId: string;
  bedCode: string;
  roomNumber: string;
  hostelId: string;
  hostelName: string;
  allocatedDate: string;
  vacatedDate?: string;
  monthlyRent: number;
  isMessIncluded: boolean;
  messPlan: string;
  monthlyMessFee: number;
  status: string;
  remarks?: string;
}

export interface AllocateBedDto {
  studentId: string;
  bedId: string;
  allocatedDate?: string;
  monthlyRent?: number;
  isMessIncluded?: boolean;
  messPlan?: string;
  monthlyMessFee?: number;
  remarks?: string;
}

export interface VacateBedDto {
  allocationId: string;
  vacatedDate?: string;
  remarks?: string;
}

export interface HostelGatePassDto {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  classOrBatch?: string;
  roomAndBed?: string;
  passNumber: string;
  outDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  purpose: string;
  parentConsentGiven: boolean;
  parentContactNumber?: string;
  wardenApprovalStatus: string;
  approvedByWarden?: string;
  remarks?: string;
  createdAt: string;
}

export interface GatePassPagedResultDto {
  items: HostelGatePassDto[];
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  activeOutCount: number;
  completedCount: number;
  overdueCount: number;
}

export interface CreateGatePassDto {
  studentId: string;
  outDate: string;
  expectedReturnDate: string;
  purpose: string;
  parentConsentGiven?: boolean;
  parentContactNumber?: string;
  remarks?: string;
}

export interface BulkRollCallDto {
  hostelId: string;
  attendanceDate: string;
  rollCallShift: string;
  items: {
    studentId: string;
    status: string;
    remarks?: string;
  }[];
}

export interface HostelOverviewSummaryDto {
  totalHostels: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  activeGatePasses: number;
  hostelerStudentsCount: number;
}

export interface HostelStudentSearchResultDto {
  id: string;
  studentName: string;
  rollNumber?: string;
  admissionNumber?: string;
  schoolRollNumber?: string;
  coachingRollNumber?: string;
  gender?: string;
  isSchoolStudent: boolean;
  isCoachingStudent: boolean;
  isHostelStudent: boolean;
  hostelBedId?: string;
  className?: string;
  sectionName?: string;
  batchName?: string;
  profilePhoto?: string;
  parentName?: string;
  parentPhone?: string;
  groupName: string;
  currentBedInfo?: string;
  isAlreadyAllocated: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class HostelService {
  private readonly baseUrl = `${API_BASE}/hostel`;

  constructor(private http: HttpClient) {}

  getOverview(): Observable<HostelOverviewSummaryDto> {
    return this.http.get<HostelOverviewSummaryDto>(`${this.baseUrl}/overview`);
  }

  getHostels(): Observable<HostelDto[]> {
    return this.http.get<HostelDto[]>(this.baseUrl);
  }

  createHostel(dto: CreateHostelDto): Observable<HostelDto> {
    return this.http.post<HostelDto>(this.baseUrl, dto);
  }

  updateHostel(id: string, dto: CreateHostelDto): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, dto);
  }

  deleteHostel(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getRooms(hostelId: string): Observable<HostelRoomDto[]> {
    return this.http.get<HostelRoomDto[]>(`${this.baseUrl}/${hostelId}/rooms`);
  }

  createRoom(dto: CreateHostelRoomDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/rooms`, dto);
  }

  deleteRoom(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/rooms/${id}`);
  }

  getBedMatrix(hostelId?: string): Observable<any[]> {
    let params = new HttpParams();
    if (hostelId) params = params.set('hostelId', hostelId);
    return this.http.get<any[]>(`${this.baseUrl}/bed-matrix`, { params });
  }

  getAvailableBeds(hostelId?: string): Observable<HostelBedDto[]> {
    let params = new HttpParams();
    if (hostelId) params = params.set('hostelId', hostelId);
    return this.http.get<HostelBedDto[]>(`${this.baseUrl}/available-beds`, { params });
  }

  allocateBed(dto: AllocateBedDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/allocate`, dto);
  }

  vacateBed(dto: VacateBedDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/vacate`, dto);
  }

  getAllocations(status?: string): Observable<HostelAllocationDto[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<HostelAllocationDto[]>(`${this.baseUrl}/allocations`, { params });
  }

  getGatePasses(params?: {
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Observable<GatePassPagedResultDto> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('search', params.search);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) httpParams = httpParams.set('sortOrder', params.sortOrder);
    if (params?.pageIndex) httpParams = httpParams.set('pageIndex', params.pageIndex.toString());
    if (params?.pageSize) httpParams = httpParams.set('pageSize', params.pageSize.toString());
    return this.http.get<GatePassPagedResultDto>(`${this.baseUrl}/gatepasses`, { params: httpParams });
  }

  createGatePass(dto: CreateGatePassDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/gatepasses`, dto);
  }

  updateGatePassStatus(id: string, status: string, remarks?: string): Observable<any> {
    let params = new HttpParams().set('status', status);
    if (remarks) params = params.set('remarks', remarks);
    return this.http.put(`${this.baseUrl}/gatepasses/${id}/status`, {}, { params });
  }

  getRollCall(hostelId: string, date: string, shift: string = 'Night'): Observable<any[]> {
    const params = new HttpParams()
      .set('hostelId', hostelId)
      .set('date', date)
      .set('shift', shift);
    return this.http.get<any[]>(`${this.baseUrl}/rollcall`, { params });
  }

  saveBulkRollCall(dto: BulkRollCallDto): Observable<any> {
    return this.http.post(`${this.baseUrl}/rollcall/bulk`, dto);
  }

  getAttendanceSettings(): Observable<{ hostelMode: 'Manual' | 'Biometric' | 'Both'; studentMode: string; teacherMode: string }> {
    return this.http.get<{ hostelMode: 'Manual' | 'Biometric' | 'Both'; studentMode: string; teacherMode: string }>(`${this.baseUrl}/attendance/settings`);
  }

  updateAttendanceSettings(hostelMode: 'Manual' | 'Biometric' | 'Both'): Observable<any> {
    return this.http.put(`${this.baseUrl}/attendance/settings`, { hostelMode });
  }

  simulateBiometricPunch(dto: { studentId?: string; biometricUserId?: string; deviceId?: string; shift?: string; punchTime?: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}/attendance/biometric-punch`, dto);
  }

  getBiometricMappings(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/attendance/biometric-mappings`);
  }

  updateBiometricMapping(studentId: string, biometricUserId: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/attendance/biometric-mappings`, { studentId, biometricUserId });
  }

  searchStudents(q?: string, type?: string, gender?: string, limit: number = 40): Observable<HostelStudentSearchResultDto[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (type) params = params.set('type', type);
    if (gender) params = params.set('gender', gender);
    params = params.set('limit', limit.toString());
    return this.http.get<HostelStudentSearchResultDto[]>(`${this.baseUrl}/students/search`, { params });
  }
}
