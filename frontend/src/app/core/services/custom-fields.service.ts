import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CustomFieldDataType = 'Text' | 'Textarea' | 'Number' | 'Date' | 'Dropdown' | 'Checkbox';

export interface CustomFieldDefinitionDto {
  id: string;
  entityType: string;
  fieldKey: string;
  fieldLabel: string;
  dataType: CustomFieldDataType | string;
  dropdownOptions: string[];
  placeholder?: string | null;
  isRequired: boolean;
  showInTable: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface SaveCustomFieldRequestDto {
  entityType: string;
  fieldLabel: string;
  fieldKey?: string | null;
  dataType: string;
  dropdownOptions?: string[] | null;
  placeholder?: string | null;
  isRequired: boolean;
  showInTable: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomFieldsService {
  private readonly baseUrl = `${environment.apiUrl}/custom-fields`;

  constructor(private http: HttpClient) {}

  getCustomFields(entityType: string = 'Student', includeInactive: boolean = false): Observable<CustomFieldDefinitionDto[]> {
    let params = new HttpParams().set('entityType', entityType);
    if (includeInactive) {
      params = params.set('includeInactive', 'true');
    }
    return this.http.get<CustomFieldDefinitionDto[]>(this.baseUrl, { params });
  }

  createCustomField(dto: SaveCustomFieldRequestDto): Observable<CustomFieldDefinitionDto> {
    return this.http.post<CustomFieldDefinitionDto>(this.baseUrl, dto);
  }

  updateCustomField(id: string, dto: SaveCustomFieldRequestDto): Observable<CustomFieldDefinitionDto> {
    return this.http.put<CustomFieldDefinitionDto>(`${this.baseUrl}/${id}`, dto);
  }

  deleteCustomField(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.baseUrl}/${id}`);
  }

  parseCustomFieldsJson(json?: string | null): Record<string, any> {
    if (!json || !json.trim()) return {};
    try {
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  serializeCustomFields(values: Record<string, any> | null | undefined): string | null {
    if (!values || typeof values !== 'object') return null;
    const cleaned: Record<string, any> = {};
    let hasAny = false;
    for (const [k, v] of Object.entries(values)) {
      if (v === null || v === undefined) continue;
      if (typeof v === 'string') {
        const trimmed = v.trim();
        if (trimmed !== '') {
          cleaned[k] = trimmed;
          hasAny = true;
        }
      } else if (typeof v === 'boolean') {
        cleaned[k] = v;
        hasAny = true;
      } else {
        cleaned[k] = v;
        hasAny = true;
      }
    }
    return hasAny ? JSON.stringify(cleaned) : null;
  }
}
