import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BriefingFinancialsDto {
  todayCollection: number;
  todayCash: number;
  todayOnlineOrUpi: number;
  todayChequeOrOther: number;
  monthToDateCollection: number;
  todayExpense: number;
  receiptsIssuedTodayCount: number;
}

export interface BriefingAttendanceDto {
  totalStudents: number;
  presentStudents: number;
  absentStudents: number;
  lateStudents: number;
  attendancePercentage: number;
  unmarkedStudentsCount: number;
  lowAttendanceAlerts: string[];
}

export interface AbsentTeacherSummaryDto {
  teacherId: string;
  teacherName: string;
  designation: string;
  leaveTypeOrStatus: string;
  reason?: string;
  affectedPeriodsCount: number;
}

export interface BriefingStaffStatusDto {
  totalStaff: number;
  presentStaff: number;
  absentStaff: number;
  staffOnLeave: number;
  absentTeachers: AbsentTeacherSummaryDto[];
}

export interface BriefingBirthdayItemDto {
  id: string;
  name: string;
  role: 'Student' | 'Staff';
  classOrDesignation?: string;
  phone?: string;
  photoUrl?: string;
}

export interface BriefingActionItemDto {
  category: 'Academic' | 'Finance' | 'Staff' | 'Admission';
  title: string;
  description: string;
  severity: 'Critical' | 'Warning' | 'Info';
  actionUrl: string;
}

export interface PrincipalMorningBriefingDto {
  briefingDateUtc: string;
  briefingDateIstFormatted: string;
  instituteName: string;
  branchName?: string;
  greetingMessageHindi: string;
  greetingMessageEnglish: string;
  aiSpokenScriptHindi: string;
  aiSpokenScriptEnglish: string;
  financials: BriefingFinancialsDto;
  attendance: BriefingAttendanceDto;
  staff: BriefingStaffStatusDto;
  birthdaysToday: BriefingBirthdayItemDto[];
  actionItems: BriefingActionItemDto[];
}

export interface SendBirthdayWishRequestDto {
  recipientId: string;
  recipientName: string;
  phone: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class PrincipalBriefingService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/principal-briefing`;

  getTodayBriefing(branchId?: string | null): Observable<PrincipalMorningBriefingDto> {
    let httpParams = new HttpParams();
    if (branchId) httpParams = httpParams.set('branchId', branchId);
    return this.http.get<PrincipalMorningBriefingDto>(`${this.apiUrl}/today`, { params: httpParams });
  }

  sendBirthdayWish(dto: SendBirthdayWishRequestDto): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/send-birthday-wishes`, dto);
  }
}
