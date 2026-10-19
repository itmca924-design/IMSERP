import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DispensedMedicine {
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  dosage?: string;
  unit?: string;
}

export interface InfirmaryVisit {
  id: string;
  tenantId: string;
  branchId?: string;
  branchName?: string;
  visitNumber: string;
  patientType: string; // 'Student' | 'Staff'
  studentId?: string;
  staffId?: string;
  patientName: string;
  classOrDesignation?: string;
  contactPhone?: string;
  visitDate: string;
  chiefComplaints: string;
  symptomsList?: string;
  temperatureF?: number;
  pulseBpm?: number;
  bloodPressure?: string;
  spO2?: number;
  severity: string; // 'Mild' | 'Moderate' | 'Severe'
  bedRestRequired: boolean;
  bedNumber?: string;
  admittedAt?: string;
  dischargedAt?: string;
  bedStatus: string; // 'NotAssigned' | 'Occupied' | 'Discharged'
  diagnosis?: string;
  treatmentGiven?: string;
  medicinesDispensed?: DispensedMedicine[];
  parentContacted: boolean;
  parentContactedAt?: string;
  parentNotificationNotes?: string;
  referredToHospital: boolean;
  hospitalName?: string;
  sentHome: boolean;
  accompaniedBy?: string;
  attendingStaffName?: string;
  status: string; // 'UnderObservation' | 'Recovered' | 'Referred' | 'SentHome' | 'Discharged'
  remarks?: string;
  createdAt: string;
}

export interface CreateInfirmaryVisit {
  branchId?: string;
  patientType: string;
  studentId?: string;
  staffId?: string;
  patientName: string;
  classOrDesignation?: string;
  contactPhone?: string;
  visitDate?: string;
  chiefComplaints: string;
  symptomsList?: string;
  temperatureF?: number;
  pulseBpm?: number;
  bloodPressure?: string;
  spO2?: number;
  severity: string;
  bedRestRequired: boolean;
  bedNumber?: string;
  admittedAt?: string;
  diagnosis?: string;
  treatmentGiven?: string;
  medicinesDispensed?: DispensedMedicine[];
  parentContacted: boolean;
  parentContactedAt?: string;
  parentNotificationNotes?: string;
  referredToHospital: boolean;
  hospitalName?: string;
  sentHome: boolean;
  accompaniedBy?: string;
  attendingStaffName?: string;
  status?: string;
  remarks?: string;
}

export interface UpdateInfirmaryVisit {
  chiefComplaints?: string;
  symptomsList?: string;
  temperatureF?: number;
  pulseBpm?: number;
  bloodPressure?: string;
  spO2?: number;
  severity?: string;
  bedRestRequired?: boolean;
  bedNumber?: string;
  admittedAt?: string;
  dischargedAt?: string;
  bedStatus?: string;
  diagnosis?: string;
  treatmentGiven?: string;
  medicinesDispensed?: DispensedMedicine[];
  parentContacted?: boolean;
  parentContactedAt?: string;
  parentNotificationNotes?: string;
  referredToHospital?: boolean;
  hospitalName?: string;
  sentHome?: boolean;
  accompaniedBy?: string;
  attendingStaffName?: string;
  status?: string;
  remarks?: string;
}

export interface DischargeInfirmaryVisit {
  dischargedAt?: string;
  status?: string;
  remarks?: string;
}

export interface InfirmaryStats {
  todayVisitsCount: number;
  currentlyOccupiedBeds: number;
  severeReferredMonthCount: number;
  totalMedicinesDispensedUnits: number;
  totalStudentVisitsMonth: number;
  totalStaffVisitsMonth: number;
}

@Injectable({
  providedIn: 'root'
})
export class InfirmaryService {
  private readonly baseUrl = `${environment.apiUrl}/infirmary`;

  constructor(private http: HttpClient) {}

  getVisits(filters: {
    branchId?: string;
    patientType?: string;
    severity?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    searchTerm?: string;
  } = {}): Observable<InfirmaryVisit[]> {
    let params = new HttpParams();
    if (filters.branchId) params = params.set('branchId', filters.branchId);
    if (filters.patientType) params = params.set('patientType', filters.patientType);
    if (filters.severity) params = params.set('severity', filters.severity);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.searchTerm) params = params.set('searchTerm', filters.searchTerm);

    return this.http.get<InfirmaryVisit[]>(`${this.baseUrl}/visits`, { params });
  }

  getVisitById(id: string): Observable<InfirmaryVisit> {
    return this.http.get<InfirmaryVisit>(`${this.baseUrl}/visits/${id}`);
  }

  getStats(branchId?: string): Observable<InfirmaryStats> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.http.get<InfirmaryStats>(`${this.baseUrl}/stats`, { params });
  }

  createVisit(dto: CreateInfirmaryVisit): Observable<InfirmaryVisit> {
    return this.http.post<InfirmaryVisit>(`${this.baseUrl}/visits`, dto);
  }

  updateVisit(id: string, dto: UpdateInfirmaryVisit): Observable<any> {
    return this.http.put(`${this.baseUrl}/visits/${id}`, dto);
  }

  dischargePatient(id: string, dto: DischargeInfirmaryVisit): Observable<any> {
    return this.http.put(`${this.baseUrl}/visits/${id}/discharge`, dto);
  }

  deleteVisit(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/visits/${id}`);
  }
}
