import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EventPhoto {
  id: string;
  eventId: string;
  photoUrl: string;
  caption?: string | null;
  uploadedAt: string;
}

export interface SchoolEvent {
  id: string;
  tenantId: string;
  branchId?: string | null;
  branchName?: string | null;
  title: string;
  category: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  description?: string | null;
  targetAudience: string;
  bannerUrl?: string | null;
  attachmentPdfUrl?: string | null;
  chiefGuestName?: string | null;
  coordinatorName?: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  photosCount: number;
  photos?: EventPhoto[] | null;
}

export interface BirthdayItem {
  id: string;
  name: string;
  role: 'Student' | 'Staff';
  classOrDepartment?: string | null;
  rollNumber?: string | null;
  photoUrl?: string | null;
  dateOfBirth: string;
  ageTurning: number;
  whatsAppPhone?: string | null;
  birthdayDateFormatted: string;
  isToday: boolean;
}

export interface DashboardCelebrationsSummary {
  upcomingEvents: SchoolEvent[];
  todayBirthdays: BirthdayItem[];
  upcomingBirthdaysThisWeek: BirthdayItem[];
  recentGalleryHighlights: EventPhoto[];
  totalEventsThisMonth: number;
  totalBirthdaysToday: number;
}

export interface CreateSchoolEventPayload {
  title: string;
  category: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  description?: string | null;
  targetAudience: string;
  bannerBase64?: string | null;
  attachmentPdfBase64?: string | null;
  chiefGuestName?: string | null;
  coordinatorName?: string | null;
  branchId?: string | null;
  sendWhatsAppBroadcast?: boolean;
}

export interface UpdateSchoolEventPayload {
  title: string;
  category: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  description?: string | null;
  targetAudience: string;
  bannerBase64?: string | null;
  attachmentPdfBase64?: string | null;
  chiefGuestName?: string | null;
  coordinatorName?: string | null;
  status: string;
  isActive: boolean;
  branchId?: string | null;
}

export interface AddEventPhotosPayload {
  photosBase64: string[];
  caption?: string | null;
}

export interface CalendarActivityItem {
  date: string;
  type: 'Holiday' | 'Event' | 'Birthday';
  title: string;
  subtitle?: string | null;
  badgeColor?: string | null;
  extra?: string | null;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class EventsService {
  private apiUrl = 'http://localhost:5000/api/events';

  constructor(private http: HttpClient) {}

  getDashboardSummary(): Observable<DashboardCelebrationsSummary> {
    return this.http.get<DashboardCelebrationsSummary>(`${this.apiUrl}/dashboard-summary`);
  }

  getEventsPaged(
    pageNumber: number = 1,
    pageSize: number = 12,
    searchTerm: string = '',
    category: string = 'All',
    status: string = 'All',
    year: number = 0
  ): Observable<PagedResult<SchoolEvent>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (searchTerm) params = params.set('searchTerm', searchTerm);
    if (category && category !== 'All') params = params.set('category', category);
    if (status && status !== 'All') params = params.set('status', status);
    if (year > 0) params = params.set('year', year.toString());

    return this.http.get<PagedResult<SchoolEvent>>(`${this.apiUrl}/paged`, { params });
  }

  getEventById(id: string): Observable<SchoolEvent> {
    return this.http.get<SchoolEvent>(`${this.apiUrl}/${id}`);
  }

  createEvent(payload: CreateSchoolEventPayload): Observable<SchoolEvent> {
    return this.http.post<SchoolEvent>(this.apiUrl, payload);
  }

  updateEvent(id: string, payload: UpdateSchoolEventPayload): Observable<SchoolEvent> {
    return this.http.put<SchoolEvent>(`${this.apiUrl}/${id}`, payload);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addEventPhotos(id: string, payload: AddEventPhotosPayload): Observable<EventPhoto[]> {
    return this.http.post<EventPhoto[]>(`${this.apiUrl}/${id}/photos`, payload);
  }

  deleteEventPhoto(photoId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/photos/${photoId}`);
  }

  getCalendarFeed(year: number, month: number): Observable<CalendarActivityItem[]> {
    const params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString());

    return this.http.get<CalendarActivityItem[]>(`${this.apiUrl}/calendar`, { params });
  }
}
