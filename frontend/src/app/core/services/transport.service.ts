import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE = 'http://localhost:5000/api';

export interface TransportOverviewDto {
  totalVehicles: number;
  activeRoutes: number;
  studentAllocations: number;
  teacherAllocations: number;
  todayBusDepartures: number;
  expiredDocumentAlerts: number;
}

export interface TransportDriverDto {
  id: string;
  fullName: string;
  phoneNumber: string;
  emergencyPhone?: string;
  licenseNumber: string;
  licenseExpiry?: string;
  aadhaarNumber?: string;
  address?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  activeVehiclesCount?: number;
}

export interface CreateTransportDriverDto {
  fullName: string;
  phoneNumber: string;
  emergencyPhone?: string;
  licenseNumber: string;
  licenseExpiry?: string;
  aadhaarNumber?: string;
  address?: string;
  photoUrl?: string;
}

export interface TransportVehicleDto {
  id: string;
  vehicleNumber: string;
  vehicleType: string;
  totalCapacity: number;
  model?: string;
  color?: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
  gpsDeviceId?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  pollutionExpiry?: string;
  isActive: boolean;
  createdAt: string;
  activeAllocationsCount?: number;
  isInsuranceExpiringSoon?: boolean;
  isFitnessExpiringSoon?: boolean;
}

export interface CreateTransportVehicleDto {
  vehicleNumber: string;
  vehicleType: string;
  totalCapacity: number;
  model?: string;
  color?: string;
  driverId?: string;
  conductorName?: string;
  conductorPhone?: string;
  gpsDeviceId?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
  pollutionExpiry?: string;
}

export interface TransportRouteStopDto {
  id: string;
  routeId: string;
  routeName?: string;
  stopName: string;
  stopOrder: number;
  pickupTime?: string;
  dropTime?: string;
  monthlyFare: number;
  quarterlyFare?: number;
  halfYearlyFare?: number;
  annualFare?: number;
  landmark?: string;
  distanceKm?: number;
  isActive: boolean;
  allocatedStudentsCount?: number;
}

export interface CreateTransportRouteStopDto {
  stopName: string;
  stopOrder: number;
  pickupTime?: string;
  dropTime?: string;
  monthlyFare: number;
  quarterlyFare?: number;
  halfYearlyFare?: number;
  annualFare?: number;
  landmark?: string;
  distanceKm?: number;
}

export interface TransportRouteDto {
  id: string;
  routeCode: string;
  routeName: string;
  startPoint?: string;
  endPoint?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  description?: string;
  morningDepartureTime?: string;
  eveningDepartureTime?: string;
  isActive: boolean;
  createdAt: string;
  stopsCount?: number;
  allocatedStudentsCount?: number;
  stops?: TransportRouteStopDto[];
}

export interface CreateTransportRouteDto {
  routeCode: string;
  routeName: string;
  startPoint?: string;
  endPoint?: string;
  vehicleId?: string;
  description?: string;
  morningDepartureTime?: string;
  eveningDepartureTime?: string;
}

export interface TransportAllocationDto {
  id: string;
  memberType: string;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  employeeCode?: string;
  routeId: string;
  routeName: string;
  routeCode: string;
  routeStopId: string;
  stopName: string;
  pickupTime?: string;
  dropTime?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  pickupDropType: string;
  monthlyFare: number;
  isFreeAllocation: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
  remarks?: string;
  createdAt: string;
}

export interface CreateTransportAllocationDto {
  memberType: string; // "Student" | "Teacher"
  studentId?: string;
  teacherId?: string;
  routeId: string;
  routeStopId: string;
  vehicleId?: string;
  pickupDropType: string; // "Both" | "PickupOnly" | "DropOnly"
  monthlyFare: number;
  isFreeAllocation?: boolean;
  effectiveFrom: string;
  remarks?: string;
}

export interface TransportBusPassDto {
  allocationId: string;
  memberType: string;
  memberName: string;
  rollOrEmpCode?: string;
  classOrDesignation?: string;
  photoUrl?: string;
  contactNumber?: string;
  routeName: string;
  routeCode: string;
  stopName: string;
  pickupTime?: string;
  dropTime?: string;
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  pickupDropType: string;
  validFrom: string;
  institutionName: string;
  logoUrl?: string;
  qrPayload?: string;
}

export interface BusBoardingManifestRowDto {
  srNo: number;
  memberType: string;
  memberName: string;
  rollOrEmpCode?: string;
  className?: string;
  stopName: string;
  scheduledTime?: string;
  contactNumber?: string;
  isBoarded: boolean;
}

export interface BusBoardingManifestDto {
  routeId: string;
  routeCode: string;
  routeName: string;
  vehicleNumber: string;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  manifestDate: string;
  departureType: string;
  totalPassengers: number;
  passengers: BusBoardingManifestRowDto[];
}

export interface CampusGatePassDto {
  id: string;
  passType: string; // "StudentEarlyExit" | "BusDeparture" | "TeacherMovement" | "Visitor"
  passNumber: string;
  studentId?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  employeeCode?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  personName?: string;
  contactNumber?: string;
  purpose: string;
  outDateTime: string;
  expectedInDateTime?: string;
  actualInDateTime?: string;
  approvedBy?: string;
  securityGuardName?: string;
  passengerCount?: number;
  status: string; // "Issued" | "Closed"
  remarks?: string;
  createdAt: string;
}

export interface CreateCampusGatePassDto {
  passType: string;
  studentId?: string;
  teacherId?: string;
  vehicleId?: string;
  personName?: string;
  contactNumber?: string;
  purpose: string;
  outDateTime: string;
  expectedInDateTime?: string;
  approvedBy?: string;
  securityGuardName?: string;
  passengerCount?: number;
  remarks?: string;
}

export interface CloseGatePassDto {
  actualInDateTime?: string;
  remarks?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TransportService {
  constructor(private http: HttpClient) {}

  // Overview
  getOverview(): Observable<TransportOverviewDto> {
    return this.http.get<TransportOverviewDto>(`${API_BASE}/transport/overview`);
  }

  // Drivers
  getDrivers(includeInactive: boolean = false): Observable<TransportDriverDto[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<TransportDriverDto[]>(`${API_BASE}/transport/drivers`, { params });
  }

  createDriver(dto: CreateTransportDriverDto): Observable<TransportDriverDto> {
    return this.http.post<TransportDriverDto>(`${API_BASE}/transport/drivers`, dto);
  }

  updateDriver(id: string, dto: CreateTransportDriverDto): Observable<void> {
    return this.http.put<void>(`${API_BASE}/transport/drivers/${id}`, dto);
  }

  toggleDriverActive(id: string): Observable<{ isActive: boolean }> {
    return this.http.patch<{ isActive: boolean }>(`${API_BASE}/transport/drivers/${id}/toggle-active`, {});
  }

  // Vehicles
  getVehicles(includeInactive: boolean = false): Observable<TransportVehicleDto[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<TransportVehicleDto[]>(`${API_BASE}/transport/vehicles`, { params });
  }

  createVehicle(dto: CreateTransportVehicleDto): Observable<TransportVehicleDto> {
    return this.http.post<TransportVehicleDto>(`${API_BASE}/transport/vehicles`, dto);
  }

  updateVehicle(id: string, dto: CreateTransportVehicleDto): Observable<void> {
    return this.http.put<void>(`${API_BASE}/transport/vehicles/${id}`, dto);
  }

  toggleVehicleActive(id: string): Observable<{ isActive: boolean }> {
    return this.http.patch<{ isActive: boolean }>(`${API_BASE}/transport/vehicles/${id}/toggle-active`, {});
  }

  // Routes
  getRoutes(includeStops: boolean = false, includeInactive: boolean = false): Observable<TransportRouteDto[]> {
    const params = new HttpParams()
      .set('includeStops', includeStops)
      .set('includeInactive', includeInactive);
    return this.http.get<TransportRouteDto[]>(`${API_BASE}/transport/routes`, { params });
  }

  getRoute(id: string): Observable<TransportRouteDto> {
    return this.http.get<TransportRouteDto>(`${API_BASE}/transport/routes/${id}`);
  }

  createRoute(dto: CreateTransportRouteDto): Observable<TransportRouteDto> {
    return this.http.post<TransportRouteDto>(`${API_BASE}/transport/routes`, dto);
  }

  updateRoute(id: string, dto: CreateTransportRouteDto): Observable<void> {
    return this.http.put<void>(`${API_BASE}/transport/routes/${id}`, dto);
  }

  toggleRouteActive(id: string): Observable<{ isActive: boolean }> {
    return this.http.patch<{ isActive: boolean }>(`${API_BASE}/transport/routes/${id}/toggle-active`, {});
  }

  // Stops
  getStops(routeId: string): Observable<TransportRouteStopDto[]> {
    return this.http.get<TransportRouteStopDto[]>(`${API_BASE}/transport/routes/${routeId}/stops`);
  }

  createStop(routeId: string, dto: CreateTransportRouteStopDto): Observable<TransportRouteStopDto> {
    return this.http.post<TransportRouteStopDto>(`${API_BASE}/transport/routes/${routeId}/stops`, dto);
  }

  updateStop(stopId: string, dto: CreateTransportRouteStopDto): Observable<void> {
    return this.http.put<void>(`${API_BASE}/transport/stops/${stopId}`, dto);
  }

  deleteStop(stopId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/transport/stops/${stopId}`);
  }

  // Allocations
  getAllocations(memberType?: string, routeId?: string, status: string = 'Active', search?: string): Observable<TransportAllocationDto[]> {
    let params = new HttpParams().set('status', status);
    if (memberType) params = params.set('memberType', memberType);
    if (routeId) params = params.set('routeId', routeId);
    if (search) params = params.set('search', search);
    return this.http.get<TransportAllocationDto[]>(`${API_BASE}/transport/allocations`, { params });
  }

  getAllocation(id: string): Observable<TransportAllocationDto> {
    return this.http.get<TransportAllocationDto>(`${API_BASE}/transport/allocations/${id}`);
  }

  allocateTransport(dto: CreateTransportAllocationDto): Observable<TransportAllocationDto> {
    return this.http.post<TransportAllocationDto>(`${API_BASE}/transport/allocate`, dto);
  }

  discontinueAllocation(id: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${API_BASE}/transport/allocations/${id}/discontinue`, {});
  }

  // Bus Pass
  getBusPass(allocationId: string): Observable<TransportBusPassDto> {
    return this.http.get<TransportBusPassDto>(`${API_BASE}/transport/allocations/${allocationId}/bus-pass`);
  }

  // Boarding Manifest
  getManifest(routeId: string, departureType: string = 'Morning'): Observable<BusBoardingManifestDto> {
    const params = new HttpParams().set('departureType', departureType);
    return this.http.get<BusBoardingManifestDto>(`${API_BASE}/transport/routes/${routeId}/manifest`, { params });
  }

  // Campus Gate Passes
  getGatePasses(passType?: string, status?: string, search?: string, pageIndex: number = 1, pageSize: number = 20): Observable<CampusGatePassDto[]> {
    let params = new HttpParams()
      .set('pageIndex', pageIndex.toString())
      .set('pageSize', pageSize.toString());
    if (passType) params = params.set('passType', passType);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<CampusGatePassDto[]>(`${API_BASE}/transport/gate-passes`, { params });
  }

  createGatePass(dto: CreateCampusGatePassDto): Observable<CampusGatePassDto> {
    return this.http.post<CampusGatePassDto>(`${API_BASE}/transport/gate-passes`, dto);
  }

  closeGatePass(id: string, dto: CloseGatePassDto): Observable<{ message: string; passNumber: string; actualInDateTime: string }> {
    return this.http.patch<{ message: string; passNumber: string; actualInDateTime: string }>(`${API_BASE}/transport/gate-passes/${id}/close`, dto);
  }
}
