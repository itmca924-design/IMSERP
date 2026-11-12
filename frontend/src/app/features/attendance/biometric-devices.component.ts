import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { AuthService } from '../../core/services/auth.service';
import { LocalDatetimePipe } from '../../shared/pipes/local-datetime.pipe';

interface Device {
  id: string; name: string; brand?: string; model?: string; serialNumber?: string;
  ipAddress?: string; port: number; connectionMode: string; isActive: boolean;
  status: string; lastSeenAt?: string; lastSyncAt?: string; lastError?: string;
}
interface EventLog {
  id: string; deviceId?: string; personType: string; biometricUserId: string;
  eventTime: string; deviceEventId?: string; status: string; errorMessage?: string;
  attendanceId?: string; receivedAt: string;
}
interface MappingPerson {
  id: string;
  personType: string;
  name: string;
  code: string;
  biometricUserId?: string;
  batchName?: string;
  className?: string;
  sectionName?: string;
  stream?: string;
  suggestedBiometricId?: string;
  isThumbEnrolled?: boolean;
  lastBiometricPunchAt?: string;
}

interface BiometricMappingPagedResult {
  items: MappingPerson[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  coachingCount: number;
  schoolCount: number;
  teacherCount: number;
}

@Component({
  selector: 'app-biometric-devices',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    LocalDatetimePipe
],
  template: `
<div class="page-container">
  <div class="page-header">
    <div>
      <h1><mat-icon>fingerprint</mat-icon> Biometric & RFID Attendance Integration</h1>
      <p>Seamless real-time synchronization with Hikvision DS-K1A802AEF (Fingerprint + 125kHz EM RFID) terminals.</p>
    </div>
    <div class="header-actions">
      <button color="primary" class="btn-header-action" (click)="prefillHikvision(); showForm = true" matButton="filled">
        <mat-icon>settings_suggest</mat-icon> <span>Add Hikvision Device</span>
      </button>
      <button color="primary" class="btn-header-action" (click)="showForm = !showForm" matButton="filled">
        <mat-icon>add</mat-icon> <span>{{ showForm ? 'Close Form' : 'Register Custom Device' }}</span>
      </button>
    </div>
  </div>

  @if (loading) {
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  }

  <!-- Hikvision DS-K1A802AEF Live Adapter Banner -->
  <mat-card class="hikvision-banner">
    <div class="banner-top">
      <div class="badge-title">
        <span class="status-indicator"></span>
        <mat-icon class="verified-icon">verified_user</mat-icon>
        <div>
          <h3>Hikvision DS-K1A802AEF Live Push Adapter Active</h3>
          <p>Real-time Biometric Fingerprint & EM-125kHz RFID punches are automatically captured in Indian Standard Time (IST).</p>
        </div>
      </div>
      <span class="protocol-chip">ISAPI / HTTP Push Ready</span>
    </div>

    <div class="webhook-container">
      <div class="webhook-label">
        <mat-icon>cloud_upload</mat-icon>
        <span>Live Webhook / HTTP Listening URL (Enter in Hikvision Terminal):</span>
      </div>
      <div class="webhook-code-row">
        <code>{{ webhookUrl }}</code>
        <button color="primary" (click)="copyWebhookUrl()" matTooltip="Copy Webhook URL" matButton="filled">
          <mat-icon>content_copy</mat-icon> Copy URL
        </button>
      </div>
    </div>

    <div class="guidelines-grid">
      <div class="guide-item">
        <mat-icon>network_check</mat-icon>
        <div>
          <strong>1. Network Setup</strong>
          <small>Assign a static LAN IP to the device using Hikvision SADP tool or Terminal UI.</small>
        </div>
      </div>
      <div class="guide-item">
        <mat-icon>http</mat-icon>
        <div>
          <strong>2. HTTP Listening Host</strong>
          <small>In Device Settings &gt; Network &gt; HTTP Listening, set destination to the Webhook URL displayed above.</small>
        </div>
      </div>
      <div class="guide-item">
        <mat-icon>badge</mat-icon>
        <div>
          <strong>3. Person Enrollment</strong>
          <small>Register student/staff with User ID (or Roll No/Adm No), then scan finger or tap RFID card.</small>
        </div>
      </div>
      <div class="guide-item">
        <mat-icon>schedule</mat-icon>
        <div>
          <strong>4. Auto In &amp; Out (IST)</strong>
          <small>1st punch of the day = Check-In, 2nd punch = Check-Out. Auto synced to attendance table.</small>
        </div>
      </div>
    </div>
  </mat-card>

  <mat-card class="mapping-card">
    <div class="section-heading">
      <div>
        <h2>Biometric &amp; RFID User Mapping</h2>
        <p>Select Coaching Student, School Student, or Teacher to map terminal IDs and RFID cards.</p>
      </div>
      <button (click)="loadPagedMappings()" matButton="filled"><mat-icon>refresh</mat-icon> Refresh People</button>
    </div>

    <!-- 3 Clear Category Tabs: Coaching, School, Teacher -->
    <div class="category-tabs-container">
      <div class="category-pills">
        <button type="button" class="pill-btn" [class.active]="activeCategory === 'Coaching'" (click)="setCategory('Coaching')">
          <mat-icon class="pill-icon">menu_book</mat-icon>
          <div class="pill-info">
            <span class="pill-title">Coaching Students</span>
            <small class="pill-sub">Batch-wise Enrollment &amp; Punch</small>
          </div>
          @if (coachingCount > 0) {
            <span class="count-badge">{{ coachingCount }}</span>
          }
        </button>

        <button type="button" class="pill-btn" [class.active]="activeCategory === 'School'" (click)="setCategory('School')">
          <mat-icon class="pill-icon">school</mat-icon>
          <div class="pill-info">
            <span class="pill-title">School Students</span>
            <small class="pill-sub">Class &amp; Section-wise Enrollment</small>
          </div>
          @if (schoolCount > 0) {
            <span class="count-badge">{{ schoolCount }}</span>
          }
        </button>

        <button type="button" class="pill-btn" [class.active]="activeCategory === 'Teacher'" (click)="setCategory('Teacher')">
          <mat-icon class="pill-icon">badge</mat-icon>
          <div class="pill-info">
            <span class="pill-title">Teachers &amp; Faculty</span>
            <small class="pill-sub">Staff Fingerprint &amp; RFID Cards</small>
          </div>
          @if (teacherCount > 0) {
            <span class="count-badge">{{ teacherCount }}</span>
          }
        </button>
      </div>
    </div>

    <!-- Clean Filter Bar (Batch / Class / Section) -->
    <div class="filter-deck">
      <!-- Coaching Batch Filter -->
      @if (activeCategory === 'Coaching') {
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Coaching Batch</mat-label>
          <mat-select [(ngModel)]="mapping.batchName" (selectionChange)="onFilterChange()">
            <mat-option value="">All Coaching Batches ({{ coachingCount }})</mat-option>
            @for (batch of batchNames; track batch) {
              <mat-option [value]="batch">{{ batch }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <!-- School Class & Section Filters -->
      @if (activeCategory === 'School') {
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>School Class</mat-label>
          <mat-select [(ngModel)]="mapping.className" (selectionChange)="onClassChange()">
            <mat-option value="">All Classes ({{ schoolCount }})</mat-option>
            @for (cls of classNames; track cls) {
              <mat-option [value]="cls">{{ cls }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Section</mat-label>
          <mat-select [(ngModel)]="mapping.sectionName" (selectionChange)="onFilterChange()">
            <mat-option value="">All Sections</mat-option>
            @for (sec of sectionNames; track sec) {
              <mat-option [value]="sec">{{ sec }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      @if (!showManualEdit) {
        <button color="primary" class="toggle-edit-btn" (click)="toggleManualEdit()" matButton="filled">
          <mat-icon>edit_note</mat-icon> Custom / RFID Card Entry
        </button>
      }
    </div>

    <!-- Collapsible Single Mapping Box (Visible ONLY when user clicks Edit or Custom) -->
    @if (showManualEdit) {
      <div class="manual-edit-panel">
        <div class="edit-panel-header">
          <div class="panel-title-wrap">
            <mat-icon class="panel-icon">edit</mat-icon>
            <div>
              <h4>{{ selectedPersonName ? 'Assign Biometric ID: ' + selectedPersonName : 'Manual Biometric / RFID Card Entry' }}</h4>
              <small>Type numeric ID or scan/tap 125kHz RFID card. Save button activates when ID is typed.</small>
            </div>
          </div>
          <button (click)="closeManualEdit()" matTooltip="Close editor" mat-icon-button>
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="edit-panel-body">
          <!-- Person Selector (if not already picked via table edit) -->
          @if (!selectedPersonName) {
            <mat-form-field appearance="outline" class="edit-field">
              <mat-label>Select Person</mat-label>
              <mat-select [(ngModel)]="mapping.personId" (selectionChange)="onPersonSelected()">
                @for (person of filteredPeople; track person) {
                  <mat-option [value]="person.id">
                    {{ person.name }} ({{ person.code }}{{ getAffiliationLabel(person) }})
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>
          }
          <!-- Biometric User ID / RFID Card Input (Green Box) -->
          <mat-form-field appearance="outline" class="edit-field" [class.field-has-value]="mapping.biometricUserId.trim()">
            <mat-label>Biometric User ID / RFID Card No</mat-label>
            <input matInput [(ngModel)]="mapping.biometricUserId" placeholder="e.g. 101 or Card 0001234567">
            @if (mapping.biometricUserId.trim()) {
              <mat-icon matSuffix class="input-suffix-icon">check_circle</mat-icon>
            }
            <mat-hint>Enter ID to activate the Save Mapping button</mat-hint>
          </mat-form-field>
          <!-- Save Button (Red Mark): ONLY VISIBLE & ACTIVE WHEN TEXT IS IN THE GREEN BOX! -->
          <div class="edit-actions">
            @if (mapping.personId && mapping.biometricUserId.trim()) {
              <button color="primary" class="save-mapping-btn app-button-save"
                (click)="saveMapping()" matButton="filled">
                <mat-icon>save</mat-icon> Save Mapping
              </button>
            }
            <button (click)="closeManualEdit()" matButton="filled" class="app-button-cancel">
              Cancel
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Enrollment Directory Toolbar -->
    <div class="directory-toolbar">
      <div class="toolbar-info">
        <h3>
          <mat-icon class="dir-icon">contacts</mat-icon>
          {{ activeCategory }} Enrollment Directory ({{ totalRecords }})
        </h3>
        <p matTooltip="Pre-calculated unique biometric device IDs for Hikvision DS-K1A802AEF enrollment and 125kHz RFID card assignment." matTooltipPosition="below">
          Pre-calculated unique biometric device IDs for Hikvision DS-K1A802AEF enrollment and 125kHz RFID card assignment.
        </p>
      </div>
      <div class="toolbar-actions">
        @if (activeCategory === 'Teacher') {
          <button color="primary" class="toolbar-action-btn btn-enroll-admin" (click)="enrollAdminAsStaff()" [disabled]="enrollingAdmin" matTooltip="Enroll the logged-in Administrator as Staff to track biometric attendance" matButton="filled">
            <mat-icon>{{ isAdminEnrolled ? 'verified_user' : 'person_add' }}</mat-icon>
            <span>{{ isAdminEnrolled ? 'Admin Enrolled ✓' : '+ Enroll Admin as Staff' }}</span>
          </button>
        }
        <button color="accent" class="toolbar-action-btn btn-auto-gen" (click)="autoGenerateIds(false)" [disabled]="autoGenerating" matTooltip="Auto-generate and save unique device IDs in database for all unmapped people in this category" matButton="filled">
          <mat-icon>{{ autoGenerating ? 'hourglass_top' : 'auto_fix_high' }}</mat-icon>
          <span>{{ autoGenerating ? 'Generating...' : '⚡ Auto-Generate All IDs' }}</span>
        </button>
        <button color="primary" class="toolbar-action-btn btn-print-sheet" (click)="printEnrollmentSheet()" matTooltip="Print physical checklist to carry to the biometric machine" matButton="filled">
          <mat-icon>print</mat-icon>
          <span>Print Enrollment Sheet</span>
        </button>
      </div>
    </div>

    @if (pagedPeople.length) {
      <div class="mobile-scroll-hint">
        <mat-icon>swipe</mat-icon> Scroll table horizontally to view all columns
      </div>
    }

    <!-- Single Loader Rule: Only ONE prominent loader during server fetch -->
    @if (isMappingsLoading) {
      <mat-progress-bar mode="indeterminate" class="table-loader-bar"></mat-progress-bar>
    }

    <!-- Responsive Enrollment Table with Server Sorting & Column Inline Filtering -->
    <div class="table-responsive">
      <table class="enroll-table" matSort (matSortChange)="onSortChange($event)">
        <thead>
          <!-- Row 1: Header Titles with Material Sort -->
          <tr class="header-main-row">
            <th class="col-sno">#</th>
            <th class="col-name" mat-sort-header="name">Name</th>
            <th class="col-code" mat-sort-header="code">
              {{ activeCategory === 'Teacher' ? 'Emp Code' : (activeCategory === 'Coaching' ? 'Coaching Roll' : 'Roll No') }}
            </th>
            <th class="col-group" mat-sort-header="group">
              {{ activeCategory === 'Teacher' ? 'Staff' : (activeCategory === 'Coaching' ? 'Coaching Batch' : 'Class & Section') }}
            </th>
            <th class="col-device-id" mat-sort-header="biometricId">Biometric Device ID</th>
            <th class="col-thumb">Thumb [✓]</th>
            <th class="col-action">Action</th>
          </tr>

          <!-- Row 2: Sub-Header Column Inline Filter Row -->
          <tr class="header-filter-row" [formGroup]="filterForm">
            <th class="col-sno filter-cell">
              <mat-icon class="sub-filter-icon" matTooltip="Server-Side Filters Active">filter_alt</mat-icon>
            </th>
            <th class="col-name filter-cell">
              <div class="filter-input-wrap">
                <mat-icon class="field-icon">search</mat-icon>
                <input type="text" formControlName="searchName" placeholder="Search name..." class="sub-filter-input">
                @if (filterForm.get('searchName')?.value) {
                  <button type="button" class="clear-cell-btn" (click)="clearFilterField('searchName')">✕</button>
                }
              </div>
            </th>
            <th class="col-code filter-cell">
              <div class="filter-input-wrap">
                <mat-icon class="field-icon">tag</mat-icon>
                <input type="text" formControlName="searchCode" placeholder="Search code..." class="sub-filter-input">
                @if (filterForm.get('searchCode')?.value) {
                  <button type="button" class="clear-cell-btn" (click)="clearFilterField('searchCode')">✕</button>
                }
              </div>
            </th>
            <th class="col-group filter-cell">
              <div class="filter-input-wrap">
                <mat-icon class="field-icon">domain</mat-icon>
                <input type="text" formControlName="searchGroup" placeholder="Filter batch/class..." class="sub-filter-input">
                @if (filterForm.get('searchGroup')?.value) {
                  <button type="button" class="clear-cell-btn" (click)="clearFilterField('searchGroup')">✕</button>
                }
              </div>
            </th>
            <th class="col-device-id filter-cell">
              <div class="filter-select-wrap">
                <select formControlName="mappingStatus" class="sub-filter-select">
                  <option value="all">All Status</option>
                  <option value="mapped">Mapped (Green)</option>
                  <option value="unmapped">Unmapped (Yellow)</option>
                  <option value="enrolled">Thumb Enrolled [✓]</option>
                  <option value="pending_thumb">Thumb Pending [ ]</option>
                </select>
              </div>
            </th>
            <th class="col-thumb filter-cell">
              <span class="thumb-summary-pill" matTooltip="Thumb enrolled count on current page">
                ✓ {{ enrolledInPageCount }}/{{ pagedPeople.length }}
              </span>
            </th>
            <th class="col-action filter-cell">
              <button type="button" class="btn-reset-filters" (click)="resetFilters()" matTooltip="Reset all filters">
                <mat-icon>restart_alt</mat-icon>
                <span>Reset</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (p of pagedPeople; track p.id; let i = $index) {
            <tr [class.unmapped-row]="!p.biometricUserId">
              <td class="col-sno">{{ (pageIndex * pageSize) + i + 1 }}</td>
              <td class="col-name">
                <strong>{{ p.name }}</strong>
              </td>
              <td class="col-code"><span class="badge-code">{{ p.code || '—' }}</span></td>
              <td class="col-group">
                <div class="group-badge-container">
                  @if (activeCategory === 'School') {
                    <div class="badge-primary-row">
                      @if (p.className) {
                        <span class="group-badge school" [matTooltip]="p.className + (p.sectionName ? ' - ' + p.sectionName : '')">🏫 {{ p.className }}{{ p.sectionName ? ' - ' + p.sectionName : '' }}</span>
                      }
                      @if (isHybrid(p) && !p.batchName) {
                        <span class="hybrid-badge" matTooltip="Hybrid Student (School + Coaching)">⚡ Hybrid</span>
                      }
                    </div>
                    @if (p.batchName || (isHybrid(p) && p.batchName)) {
                      <div class="badge-secondary-row">
                        @if (p.batchName) {
                          <span class="group-badge batch secondary-badge" [matTooltip]="p.batchName">📚 {{ p.batchName }}</span>
                        }
                        @if (isHybrid(p)) {
                          <span class="hybrid-badge" matTooltip="Hybrid Student (School + Coaching)">⚡ Hybrid</span>
                        }
                      </div>
                    }
                  } @else if (activeCategory === 'Coaching') {
                    <div class="badge-primary-row">
                      @if (p.batchName) {
                        <span class="group-badge batch" [matTooltip]="p.batchName">📚 {{ p.batchName }}</span>
                      }
                    </div>
                    @if (p.className || isHybrid(p)) {
                      <div class="badge-secondary-row">
                        @if (p.className) {
                          <span class="group-badge school secondary-badge" [matTooltip]="p.className + (p.sectionName ? ' - ' + p.sectionName : '')">🏫 {{ p.className }}{{ p.sectionName ? ' - ' + p.sectionName : '' }}</span>
                        }
                        @if (isHybrid(p)) {
                          <span class="hybrid-badge" matTooltip="Hybrid Student (School + Coaching)">⚡ Hybrid</span>
                        }
                      </div>
                    }
                  } @else {
                    @if (p.personType === 'Teacher') {
                      <span class="group-badge teacher">👨‍🏫 Faculty</span>
                    }
                  }
                </div>
              </td>
              <td class="col-device-id">
                @if (p.biometricUserId) {
                  <span class="bio-tag mapped" matTooltip="Mapped in Database">
                    <mat-icon>fingerprint</mat-icon> {{ p.biometricUserId }}
                  </span>
                }
                @if (!p.biometricUserId && p.suggestedBiometricId) {
                  <span class="bio-tag suggested" matTooltip="Auto-generated suggested ID">
                    <mat-icon>lightbulb</mat-icon> Suggested: <strong>{{ p.suggestedBiometricId }}</strong>
                  </span>
                }
                @if (!p.biometricUserId && !p.suggestedBiometricId) {
                  <span class="bio-tag unmapped">
                    <mat-icon>warning</mat-icon> Unmapped
                  </span>
                }
              </td>
              <td class="col-thumb">
                <button
                  type="button"
                  class="thumb-check-btn"
                  [class.enrolled]="p.isThumbEnrolled"
                  (click)="toggleThumbEnrollment(p)"
                  [matTooltip]="getThumbTooltip(p)">
                  @if (p.isThumbEnrolled) {
                    <span class="thumb-box checked">[ ✓ ]</span>
                    <span class="thumb-text">Enrolled</span>
                  } @else {
                    <span class="thumb-box">[ &nbsp; ]</span>
                    <span class="thumb-text">Mark ✓</span>
                  }
                </button>
              </td>
              <td class="col-action">
                @if (!p.biometricUserId && p.suggestedBiometricId) {
                  <button color="accent" class="btn-xs" (click)="quickAssignSuggested(p)" matTooltip="Assign this ID in DB now" matButton="filled">
                    <mat-icon>check_circle</mat-icon> Apply {{ p.suggestedBiometricId }}
                  </button>
                }
                <button type="button" class="btn-icon-xs" (click)="selectPersonForEdit(p)" matTooltip="Select for Edit">
                  <mat-icon>edit</mat-icon>
                </button>
              </td>
            </tr>
          }
          @if (!pagedPeople.length && !isMappingsLoading) {
            <tr>
              <td colspan="7" class="empty-cell">
                <div class="empty-state-wrap">
                  <mat-icon>search_off</mat-icon>
                  <span>No {{ activeCategory.toLowerCase() }} found matching current filters.</span>
                  <button class="btn-clear-empty" (click)="resetFilters()">Clear Filters</button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>

      <!-- Server-Side Material Paginator -->
      <mat-paginator
        [length]="totalRecords"
        [pageSize]="pageSize"
        [pageIndex]="pageIndex"
        [pageSizeOptions]="[10, 25, 50, 100, 150, 200, 300, 500]"
        (page)="onPageChange($event)"
        showFirstLastButtons
        class="enroll-paginator">
      </mat-paginator>
    </div>
  </mat-card>

  @if (showForm) {
    <mat-card class="form-card">
      <div class="form-card-header">
        <h2>{{ editingId ? 'Edit Device Configuration' : 'Register Biometric / RFID Terminal' }}</h2>
        @if (!editingId) {
          <button color="accent" (click)="prefillHikvision()" matButton="filled">
            <mat-icon>auto_fix_high</mat-icon> Auto-Fill DS-K1A802AEF Defaults
          </button>
        }
      </div>
      <div class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Device Name</mat-label>
          <input matInput [(ngModel)]="form.name" placeholder="e.g. Main Gate Biometric">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Brand</mat-label>
          <input matInput [(ngModel)]="form.brand">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Model</mat-label>
          <input matInput [(ngModel)]="form.model">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Serial Number (from device label)</mat-label>
          <input matInput [(ngModel)]="form.serialNumber" placeholder="e.g. DS-K1A802AEF20230501...">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>LAN IP Address</mat-label>
          <input matInput [(ngModel)]="form.ipAddress" placeholder="192.168.1.100">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Device Port</mat-label>
          <input matInput type="number" [(ngModel)]="form.port">
        </mat-form-field>
      </div>
      <div class="actions">
        <button (click)="cancelForm()" matButton="filled" class="app-button-cancel">Cancel</button>
        <button color="primary" (click)="saveDevice()" [disabled]="!form.name" matButton="filled" class="app-button-save">Save Device</button>
      </div>
    </mat-card>
  }

  <div class="device-grid">
    @for (device of devices; track device) {
      <mat-card class="device-card">
        <div class="device-heading">
          <mat-icon class="dev-icon">devices</mat-icon>
          <div>
            <strong>{{device.name}}</strong>
            <small>{{device.brand || 'Hikvision'}} {{device.model || 'DS-K1A802AEF'}}</small>
          </div>
          <span class="status" [class.ready]="device.status === 'Online'">{{device.status}}</span>
        </div>
        <div class="device-meta">
          <span>Serial: <strong>{{device.serialNumber || 'Not set'}}</strong></span>
          <span>IP: <strong>{{device.ipAddress || 'No IP'}}:{{device.port}}</strong></span>
        </div>
        @if (device.lastError) {
          <small class="error">{{device.lastError}}</small>
        }
        <div class="actions">
          <button color="primary" (click)="testConnection(device)" matButton="filled">
            <mat-icon>sync</mat-icon> Test Socket Connection
          </button>
          <button (click)="editDevice(device)" matTooltip="Edit device" mat-icon-button>
            <mat-icon>edit</mat-icon>
          </button>
        </div>
      </mat-card>
    }
    @if (!devices.length) {
      <mat-card class="empty-device-card">
        <div class="empty-device-main">
          <div class="empty-device-icon-box">
            <mat-icon>devices_other</mat-icon>
          </div>
          <div class="empty-device-text">
            <h3>No Biometric Terminals Registered Yet</h3>
            <p>Register your Hikvision fingerprint or RFID terminal to monitor live status, IP configuration, and socket connectivity.</p>
          </div>
        </div>
        <button color="primary" class="btn-empty-add-device" (click)="prefillHikvision(); showForm = true" matButton="filled">
          <mat-icon>settings_suggest</mat-icon>
          <span>Add Hikvision Device</span>
        </button>
      </mat-card>
    }
  </div>

  <mat-card class="simulation-card">
    <div class="section-heading">
      <div>
        <h2>Test Punch Simulation</h2>
        <p>Instantly test fingerprint or RFID punches to verify live Check-In &amp; Check-Out behavior in IST.</p>
      </div>
      <button (click)="loadEvents()" [disabled]="eventsLoading" matButton="filled">
        <mat-icon>{{eventsLoading ? 'sync' : 'refresh'}}</mat-icon> {{eventsLoading ? 'Refreshing...' : 'Refresh Events'}}
      </button>
    </div>
    <div class="form-grid">
      <mat-form-field appearance="outline">
        <mat-label>Person Type</mat-label>
        <mat-select [(ngModel)]="simulation.personType">
          <mat-option value="Coaching Student">📚 Coaching Student</mat-option>
          <mat-option value="School Student">🏫 School Student</mat-option>
          <mat-option value="Teacher">👨‍🏫 Teacher / Faculty</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Biometric User ID / RFID Card No</mat-label>
        <input matInput [(ngModel)]="simulation.biometricUserId" placeholder="Mapped ID / Roll No / Card No">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Device Event ID</mat-label>
        <input matInput [(ngModel)]="simulation.eventId" placeholder="Optional unique event ID">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Device</mat-label>
        <mat-select [(ngModel)]="simulation.deviceId">
          <mat-option [value]="''">Hikvision DS-K1A802AEF Push Adapter</mat-option>
          @for (device of devices; track device) {
            <mat-option [value]="device.id">{{device.name}}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>
    <div class="actions">
      <button color="primary" (click)="simulatePunch()" [disabled]="!simulation.biometricUserId || simulating" matButton="filled">
        <mat-icon>fingerprint</mat-icon> Trigger Live Punch
      </button>
      @if (message) {
        <span class="message">{{message}}</span>
      }
    </div>
  </mat-card>

  <mat-card class="events-card">
    <div class="section-heading">
      <div>
        <h2>Recent Biometric &amp; RFID Events <small>(IST - Asia/Kolkata)</small></h2>
        <p>Live stream of attendance punches (Auto-polling every 5 seconds).</p>
      </div>
      <div class="events-actions">
        <button (click)="toggleLiveSync()" [class.live-active]="isLiveSync" matTooltip="Toggle 5-second automatic polling" matButton="filled">
          <mat-icon>{{ isLiveSync ? 'sync' : 'sync_disabled' }}</mat-icon>
          {{ isLiveSync ? 'Live Sync Active (5s)' : 'Live Sync Paused' }}
        </button>
        <button (click)="loadEvents()" [disabled]="eventsLoading" matButton="filled">
          <mat-icon>{{eventsLoading ? 'sync' : 'refresh'}}</mat-icon> Refresh
        </button>
      </div>
    </div>
    @for (event of events; track event) {
      <div class="event-row">
        <span class="event-icon"><mat-icon>fingerprint</mat-icon></span>
        <div>
          <strong>{{event.personType}} / {{event.biometricUserId}}</strong>
          <small>{{event.eventTime | localDatetime:'datetime'}} · {{event.deviceEventId || 'No event ID'}}</small>
          @if (event.errorMessage) {
            <small class="event-error">{{event.errorMessage}}</small>
          }
        </div>
        <span class="event-status" [class.processed]="event.status === 'Processed'" [class.failed]="event.status === 'Failed'">{{event.status}}</span>
        @if (event.status === 'Failed') {
          <button (click)="retryEvent(event)" matTooltip="Retry failed event" mat-icon-button>
            <mat-icon>replay</mat-icon>
          </button>
        }
      </div>
    }
    @if (!events.length) {
      <p class="empty-text">No biometric events received yet.</p>
    }
  </mat-card>
</div>`,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [`
:host {
  display: block;
  width: 100%;
}
.page-container {
  padding: 0 0 40px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.page-header h1 {
  margin: 0;
  color: #1e3a8a;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.3;

  mat-icon {
    font-size: 24px;
    width: 24px;
    height: 24px;
    color: #2563eb;
    flex-shrink: 0;
  }
}
.page-header p, .section-heading p {
  margin: 3px 0 0;
  color: #64748b;
  font-size: 0.84rem;
  line-height: 1.4;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: nowrap;
  flex-shrink: 0;

  .btn-header-action,
  button {
    white-space: nowrap !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 0 16px !important;
    height: 40px !important;
    min-height: 40px !important;
    line-height: 40px !important;
    font-size: 0.85rem !important;
    font-weight: 600 !important;
    border-radius: 8px !important;
    flex-shrink: 0 !important;

    .mdc-button__label {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      white-space: nowrap !important;
      word-break: keep-all !important;
    }

    mat-icon {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      line-height: 18px !important;
      margin-right: 2px !important;
    }
  }
}
.hikvision-banner {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #e0f2fe 100%);
  border: 1px solid #86efac;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}
.banner-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}
.badge-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: 0 0 0 4px rgba(22, 163, 74, 0.2);
  display: inline-block;
}
.verified-icon {
  color: #16a34a;
  font-size: 28px;
  width: 28px;
  height: 28px;
}
.badge-title h3 {
  margin: 0;
  color: #14532d;
  font-size: 1.15rem;
  font-weight: 700;
}
.badge-title p {
  margin: 2px 0 0;
  color: #166534;
  font-size: 0.88rem;
}
.protocol-chip {
  background: #15803d;
  color: #ffffff;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.webhook-container {
  background: #ffffff;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.webhook-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #1e3a8a;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 6px;
}
.webhook-label mat-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
}
.webhook-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.webhook-code-row code {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 0.95rem;
  color: #0f172a;
  flex: 1;
  word-break: break-all;
}
.guidelines-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.guide-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(255, 255, 255, 0.7);
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(134, 239, 172, 0.4);
}
.guide-item mat-icon {
  color: #2563eb;
  font-size: 22px;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 22px;
  margin-top: 2px;
}
.guide-item > div {
  min-width: 0;
}
.guide-item strong {
  display: block;
  font-size: 0.85rem;
  color: #1e293b;
}
.guide-item small {
  display: block;
  font-size: 0.76rem;
  color: #475569;
  line-height: 1.3;
}
.form-card, .mapping-card, .simulation-card, .events-card {
  padding: 22px;
  border-radius: 12px;
}
.form-card-header, .section-heading, .device-heading, .actions {
  display: flex;
  align-items: center;
}
.form-card-header, .section-heading {
  justify-content: space-between;
  margin-bottom: 16px;
}
.form-card-header h2, .section-heading h2, .events-card h2 {
  margin: 0;
  color: #1e3a8a;
  font-size: 1.15rem;
  font-weight: 700;
}
.category-tabs-container {
  margin-bottom: 20px;
}
.category-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.pill-btn {
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  padding: 14px 18px !important;
  background: #ffffff !important;
  border: 2px solid #e2e8f0 !important;
  border-radius: 12px !important;
  cursor: pointer !important;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  text-align: left !important;
  position: relative !important;
  width: 100% !important;
  box-sizing: border-box !important;
  height: auto !important;
  min-height: 72px !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
}
.pill-btn:hover {
  background: #f8fafc !important;
  border-color: #93c5fd !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px -2px rgba(0, 0, 0, 0.08) !important;
}
.pill-btn.active {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%) !important;
  border-color: #2563eb !important;
  box-shadow: 0 4px 14px -2px rgba(37, 99, 235, 0.25) !important;
}
.pill-icon {
  font-size: 30px !important;
  width: 30px !important;
  height: 30px !important;
  color: #64748b !important;
  flex-shrink: 0 !important;
}
.pill-btn.active .pill-icon {
  color: #2563eb !important;
}
.pill-info {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 !important;
  min-width: 0 !important;
  gap: 3px !important;
}
.pill-title {
  font-size: 0.98rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  line-height: 1.3 !important;
  white-space: normal !important;
  word-break: break-word !important;
}
.pill-btn.active .pill-title {
  color: #1e40af !important;
}
.pill-sub {
  font-size: 0.78rem !important;
  color: #64748b !important;
  line-height: 1.25 !important;
  white-space: normal !important;
  word-break: break-word !important;
}
.pill-btn.active .pill-sub {
  color: #2563eb !important;
}
.count-badge {
  background: #f1f5f9 !important;
  color: #475569 !important;
  padding: 4px 10px !important;
  border-radius: 20px !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  border: 1px solid #cbd5e1 !important;
  flex-shrink: 0 !important;
  margin-left: auto !important;
}
.pill-btn.active .count-badge {
  background: #2563eb !important;
  color: #ffffff !important;
  border-color: #2563eb !important;
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3) !important;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.filter-deck {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.filter-field {
  min-width: 240px;
  flex: 1;
}
.toggle-edit-btn {
  height: 48px;
  border-radius: 8px;
  margin-bottom: 22px;
}
.manual-edit-panel {
  background: #f8fafc;
  border: 1.5px solid #bfdbfe;
  border-radius: 12px;
  padding: 16px 20px;
  margin: 12px 0 20px;
  animation: panelSlideIn 0.25s ease-in-out;
}
@keyframes panelSlideIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
.edit-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 10px;
}
.panel-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.panel-icon {
  color: #2563eb;
  font-size: 22px;
  width: 22px;
  height: 22px;
}
.panel-title-wrap h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e3a8a;
}
.panel-title-wrap small {
  color: #64748b;
  font-size: 0.8rem;
}
.edit-panel-body {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  align-items: start;
}
.field-has-value input {
  font-weight: 700;
  color: #15803d;
}
.input-suffix-icon {
  color: #16a34a;
  font-size: 20px;
}
.edit-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
}
.save-mapping-btn {
  background: #2563eb !important;
  color: #ffffff !important;
  font-weight: 600;
}
.directory-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
  flex-wrap: nowrap;
}
.toolbar-info {
  flex: 1;
  min-width: 0;
}
.toolbar-info h3 {
  margin: 0;
  color: #1e3a8a;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
}
.dir-icon {
  color: #2563eb;
  font-size: 20px;
  width: 20px;
  height: 20px;
}
.toolbar-info p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: help;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
  flex-shrink: 0;
}
.toolbar-action-btn {
  white-space: nowrap !important;
  height: 38px !important;
  min-height: 38px !important;
  line-height: 38px !important;
  padding: 0 12px !important;
  border-radius: 8px !important;
  font-size: 0.82rem !important;
  font-weight: 600 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;

  .mdc-button__label {
    display: inline-flex !important;
    align-items: center !important;
    gap: 5px !important;
    white-space: nowrap !important;
  }

  mat-icon {
    font-size: 17px !important;
    width: 17px !important;
    height: 17px !important;
    line-height: 17px !important;
    margin-right: 2px !important;
  }
}
.mobile-scroll-hint {
  display: none;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #64748b;
  margin-top: 12px;
  margin-bottom: -4px;
}
.mobile-scroll-hint mat-icon {
  font-size: 16px;
  width: 16px;
  height: 16px;
  color: #3b82f6;
}
.table-responsive {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-sizing: border-box;
  display: block;
}
.table-loader-bar {
  margin-bottom: -4px;
  height: 4px;
  border-radius: 4px 4px 0 0;
  z-index: 5;
  position: relative;
}
.enroll-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  white-space: nowrap;
}
.enroll-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
}
.header-main-row th {
  background: #f1f5f9;
  color: #1e3a8a;
  user-select: none;
}
.header-filter-row th {
  background: #f8fafc;
  padding: 8px 10px;
  border-bottom: 2px solid #cbd5e1;
  vertical-align: middle;
}
.sub-filter-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  color: #2563eb;
  margin: 0 auto;
  display: block;
}
.filter-input-wrap {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 8px;
  gap: 6px;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}
.filter-input-wrap:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.filter-input-wrap .field-icon {
  font-size: 15px;
  width: 15px;
  height: 15px;
  color: #94a3b8;
  flex-shrink: 0;
}
.sub-filter-input {
  border: none;
  outline: none;
  width: 100%;
  font-size: 0.8rem;
  color: #0f172a;
  padding: 4px 0;
  background: transparent;
  min-width: 90px;
}
.clear-cell-btn {
  background: none;
  border: none;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.clear-cell-btn:hover {
  color: #dc2626;
}
.filter-select-wrap {
  width: 100%;
}
.sub-filter-select {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 0.8rem;
  background: #ffffff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}
.sub-filter-select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.btn-reset-filters {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-reset-filters mat-icon {
  font-size: 14px;
  width: 14px;
  height: 14px;
}
.btn-reset-filters:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #b91c1c;
}
.enroll-paginator {
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 8px 8px;
}
.empty-state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: #64748b;
}
.empty-state-wrap mat-icon {
  font-size: 36px;
  width: 36px;
  height: 36px;
  color: #94a3b8;
}
.btn-clear-empty {
  margin-top: 4px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-clear-empty:hover {
  background: #1d4ed8;
}
.enroll-table td {
  padding: 11px 14px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.88rem;
  color: #1e293b;
}
.enroll-table tbody tr:hover {
  background: #f8fafc;
}
.enroll-table tbody tr.unmapped-row {
  background: #fffdf7;
}
.col-sno {
  width: 44px;
  min-width: 36px;
  color: #94a3b8;
  text-align: center;
}
.col-name {
  min-width: 130px;
  max-width: 180px;
}
.col-name strong {
  display: block;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.badge-code {
  background: #f1f5f9;
  color: #334155;
  padding: 3px 8px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.82rem;
  font-weight: 600;
}
.col-code {
  width: 95px;
  min-width: 80px;
  white-space: nowrap;
}
.col-group {
  min-width: 170px;
  max-width: 260px;
  overflow: hidden;
}
.group-badge-container {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 3px;
  max-width: 100%;
  overflow: hidden;
}
.badge-primary-row,
.badge-secondary-row {
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  width: 100%;
  overflow: hidden;
}
.hybrid-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
  color: #b45309;
  border: 1px solid #fcd34d;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 0.71rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.25;
  box-shadow: 0 1px 2px rgba(245, 158, 11, 0.12);
  white-space: nowrap;
  flex-shrink: 0;
}
.group-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: all 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex-shrink: 1;
}
.group-badge.secondary-badge {
  font-size: 0.74rem;
  padding: 2px 7px;
  border-radius: 5px;
  opacity: 0.9;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-badge.school {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.group-badge.batch {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.group-badge.teacher {
  background: #faf5ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
}
.col-device-id {
  width: 140px;
  min-width: 125px;
  white-space: nowrap;
}
.bio-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}
.bio-tag mat-icon {
  font-size: 15px;
  width: 15px;
  height: 15px;
}
.bio-tag.mapped {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #86efac;
}
.bio-tag.suggested {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fde047;
}
.bio-tag.unmapped {
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fca5a5;
}
.col-thumb {
  width: 120px;
  min-width: 110px;
  white-space: nowrap;
  text-align: center;
}
.thumb-summary-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  border-radius: 6px;
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
  font-size: 0.74rem;
  font-weight: 700;
}
.thumb-check-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #64748b;
  transition: all 0.15s ease;
  white-space: nowrap;

  .thumb-box {
    font-family: monospace;
    font-weight: 800;
    font-size: 0.82rem;
  }

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
  }

  &.enrolled {
    border: 1px solid #86efac;
    background: #dcfce7;
    color: #15803d;

    .thumb-box.checked {
      color: #15803d;
    }

    &:hover {
      background: #bbf7d0;
      border-color: #4ade80;
    }
  }
}
.btn-xs {
  font-size: 0.78rem;
  line-height: 28px;
  padding: 0 10px;
}
.btn-xs mat-icon {
  font-size: 16px;
  width: 16px;
  height: 16px;
  margin-right: 4px;
}
.btn-icon-xs {
  width: 30px !important;
  height: 30px !important;
  min-width: 30px !important;
  max-width: 30px !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 50% !important;
  aspect-ratio: 1 / 1 !important;
  box-sizing: border-box !important;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #475569;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  cursor: pointer;
  outline: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);

  mat-icon {
    font-size: 16px !important;
    width: 16px !important;
    height: 16px !important;
    line-height: 16px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin: 0 !important;
    padding: 0 !important;
    color: #475569;
    transition: color 0.15s ease;
  }

  &:hover {
    background: #eff6ff;
    border-color: #93c5fd;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 0 8px rgba(37, 99, 235, 0.28) !important;
    transform: scale(1.08);

    mat-icon {
      color: #2563eb;
    }
  }

  &:active {
    transform: scale(0.94);
  }
}
.empty-cell {
  text-align: center;
  padding: 30px;
  color: #64748b;
  font-style: italic;
}
.col-action {
  text-align: right;
  white-space: nowrap;
  width: 110px;
  min-width: 95px;
}
.header-main-row th.col-action {
  text-align: right;
}
.header-filter-row th.col-action {
  text-align: right;
}
.col-span-2 {
  grid-column: 1 / -1;
}
.actions {
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}
.device-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.device-card {
  padding: 20px;
  border-radius: 12px;
}
.device-heading {
  gap: 10px;
}
.dev-icon {
  color: #2563eb;
  font-size: 26px;
  width: 26px;
  height: 26px;
}
.device-heading div {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.device-heading small, .device-meta, .event-row small {
  color: #64748b;
  font-size: 0.8rem;
}
.status, .event-status {
  padding: 4px 10px;
  border-radius: 12px;
  background: #fff7ed;
  color: #c2410c;
  font-size: 0.75rem;
  font-weight: 600;
}
.status.ready, .event-status.processed {
  background: #dcfce7;
  color: #15803d;
}
.event-status.failed {
  background: #fee2e2;
  color: #b91c1c;
}
.device-meta {
  display: flex;
  justify-content: space-between;
  margin: 16px 0 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
}
.device-meta strong {
  color: #0f172a;
}
.error, .event-error {
  display: block;
  color: #b91c1c;
  margin-bottom: 10px;
  font-size: 0.82rem;
}
.empty-device-card {
  grid-column: 1 / -1;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 20px;
  padding: 20px 24px !important;
  border-radius: 14px !important;
  background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%) !important;
  border: 1px dashed #93c5fd !important;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03) !important;
}
.empty-device-main {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
}
.empty-device-icon-box {
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22);

  mat-icon {
    font-size: 24px;
    width: 24px;
    height: 24px;
    color: #ffffff;
  }
}
.empty-device-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  h3 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.3;
  }

  p {
    margin: 0;
    font-size: 0.84rem;
    color: #64748b;
    line-height: 1.4;
  }
}
.btn-empty-add-device {
  flex-shrink: 0;
  height: 38px !important;
  padding: 0 18px !important;
  border-radius: 999px !important;
  font-size: 0.83rem !important;
  font-weight: 700 !important;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
  color: #ffffff !important;
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.22) !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  white-space: nowrap;

  mat-icon {
    font-size: 18px !important;
    width: 18px !important;
    height: 18px !important;
    margin: 0 !important;
  }
}
@media (max-width: 768px) {
  .empty-device-card {
    flex-direction: column !important;
    align-items: stretch !important;
    padding: 16px !important;
  }
  .btn-empty-add-device {
    width: 100%;
    justify-content: center !important;
  }
}
.event-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #e2e8f0;
}
.event-row div {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.event-icon {
  color: #2563eb;
}
.empty-text {
  color: #64748b;
}
.events-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.live-active {
  background: #dcfce7 !important;
  color: #15803d !important;
  border-color: #86efac !important;
  font-weight: 600 !important;
}
@media (max-width: 1440px) {
  .enroll-table th {
    padding: 8px 8px;
    font-size: 0.73rem;
  }
  .enroll-table td {
    padding: 7px 8px;
    font-size: 0.8rem;
  }
  .col-sno {
    width: 32px;
    min-width: 28px;
  }
  .col-name {
    min-width: 110px;
    max-width: 140px;
  }
  .col-code {
    width: 78px;
    min-width: 68px;
  }
  .col-group {
    min-width: 140px;
    max-width: 210px;
  }
  .group-badge {
    font-size: 0.72rem;
    padding: 2px 6px;
  }
  .hybrid-badge {
    font-size: 0.66rem;
    padding: 1px 5px;
  }
  .col-device-id {
    width: 120px;
    min-width: 110px;
  }
  .bio-tag {
    font-size: 0.74rem;
    padding: 2px 6px;
  }
  .bio-tag mat-icon {
    font-size: 13px;
    width: 13px;
    height: 13px;
  }
  .sub-filter-input {
    min-width: 45px;
    font-size: 0.73rem;
    padding: 2px 0;
  }
  .sub-filter-select {
    font-size: 0.73rem;
    padding: 2px 4px;
  }
  .btn-reset-filters {
    padding: 3px 6px;
    font-size: 0.7rem;
  }
  .col-action {
    width: 95px;
    min-width: 85px;
  }
  .btn-xs {
    font-size: 0.7rem;
    line-height: 22px;
    padding: 0 6px;
  }
  .btn-xs mat-icon {
    font-size: 13px;
    width: 13px;
    height: 13px;
  }
  .btn-icon-xs {
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    max-width: 26px !important;

    mat-icon {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      line-height: 14px !important;
    }
  }
}

@media (max-width: 1024px) {
  .guidelines-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 768px) {
  .form-grid, .mapping-card > .form-grid, .device-grid, .guidelines-grid, .category-pills {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
  }
  .page-header h1 {
    font-size: 1.18rem;
    line-height: 1.35;
    flex-wrap: wrap;
  }
  .header-actions {
    flex-direction: column;
    width: 100%;
    gap: 8px;
  }
  .header-actions button {
    width: 100%;
    min-height: 42px;
    justify-content: center;
  }
  .banner-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  .badge-title {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 10px;
  }
  .badge-title h3 {
    font-size: 1.05rem;
    line-height: 1.35;
  }
  .protocol-chip {
    align-self: flex-start;
    font-size: 0.75rem;
    padding: 4px 10px;
    white-space: nowrap;
  }
  .webhook-code-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .webhook-code-row code {
    font-size: 0.85rem;
    padding: 10px;
    word-break: break-all;
  }
  .webhook-code-row button {
    width: 100%;
    min-height: 40px;
    justify-content: center;
  }
  .section-heading {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    margin-bottom: 14px;
  }
  .section-heading > div {
    width: 100%;
  }
  .section-heading h2 {
    font-size: 1.05rem;
    line-height: 1.35;
  }
  .section-heading > button {
    width: 100%;
    min-height: 40px;
    justify-content: center;
  }
  .events-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 8px;
  }
  .events-actions button {
    width: 100%;
    min-height: 40px;
    justify-content: center;
  }
  .filter-deck {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 12px;
  }
  .filter-field {
    width: 100%;
    min-width: 100%;
  }
  .toggle-edit-btn {
    width: 100%;
    margin-bottom: 4px;
    height: 44px;
    justify-content: center;
  }
  .manual-edit-panel {
    padding: 12px 14px;
    margin: 10px 0 16px;
  }
  .edit-panel-header {
    align-items: flex-start;
    gap: 10px;
  }
  .panel-title-wrap {
    flex: 1;
    align-items: flex-start;
  }
  .edit-panel-body {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .edit-actions {
    flex-direction: column;
    height: auto;
    width: 100%;
    gap: 8px;
    margin-top: 4px;
  }
  .edit-actions button {
    width: 100%;
    min-height: 42px;
    justify-content: center;
  }
  .directory-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    margin-top: 18px;
    padding-top: 16px;
  }
  .toolbar-info h3 {
    font-size: 1rem;
    line-height: 1.35;
  }
  .toolbar-actions {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    gap: 8px;
  }
  .category-pills {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .pill-btn {
    padding: 12px 14px !important;
    min-height: 62px !important;
    gap: 12px !important;
  }
  .pill-icon {
    font-size: 26px !important;
    width: 26px !important;
    height: 26px !important;
  }
  .pill-title {
    font-size: 0.92rem !important;
  }
  .pill-sub {
    font-size: 0.74rem !important;
  }
  .toolbar-actions button,
  .toolbar-action-btn {
    width: 100%;
    min-height: 42px;
    height: auto;
    padding: 8px 16px;
    justify-content: center;
    white-space: normal;
  }
  .mobile-scroll-hint {
    display: flex;
  }
  .device-heading {
    flex-wrap: wrap;
    gap: 8px;
  }
  .device-meta {
    flex-direction: column;
    gap: 6px;
  }
  .device-card .actions,
  .simulation-card .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-top: 12px;
  }
  .device-card .actions button,
  .simulation-card .actions button {
    width: 100%;
    min-height: 42px;
    justify-content: center;
  }
  .form-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .form-card-header button {
    width: 100%;
    min-height: 40px;
    justify-content: center;
  }
  .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .actions button {
    width: 100%;
    min-height: 42px;
    justify-content: center;
  }
}
@media (max-width: 640px) {
  .form-card, .mapping-card, .simulation-card, .events-card, .hikvision-banner {
    padding: 14px 12px;
    border-radius: 10px;
  }
  .page-container {
    gap: 14px;
  }
  .event-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .event-status {
    align-self: flex-start;
  }
}
`]
})
export class BiometricDevicesComponent implements OnInit, OnDestroy {
  private api = environment.apiUrl;
  webhookUrl = '';
  devices: Device[] = [];
  events: EventLog[] = [];
  people: MappingPerson[] = [];

  // Server-Side Paged Directory State
  pagedPeople: MappingPerson[] = [];
  totalRecords = 0;
  pageSize = 25;
  pageIndex = 0;
  sortBy = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  isMappingsLoading = false;
  serverCoachingCount = 0;
  serverSchoolCount = 0;
  serverTeacherCount = 0;

  filterForm = new FormGroup({
    searchName: new FormControl('', { nonNullable: true }),
    searchCode: new FormControl('', { nonNullable: true }),
    searchGroup: new FormControl('', { nonNullable: true }),
    mappingStatus: new FormControl('all', { nonNullable: true })
  });

  private filterSubscription?: Subscription;

  loading = false;
  eventsLoading = false;
  simulating = false;
  isLiveSync = true;
  private liveSyncTimer?: any;
  showForm = false;
  editingId = '';
  message = '';
  form = {
    name: 'Main Gate Terminal',
    brand: 'Hikvision',
    model: 'DS-K1A802AEF',
    serialNumber: '',
    ipAddress: '192.168.1.100',
    port: 80,
    connectionMode: 'ISAPI / HTTP Push',
    isActive: true
  };
  simulation = { personType: 'Student', biometricUserId: '', eventId: `SIM-${Date.now()}`, deviceId: '' };
  mapping = {
    personType: 'Student',
    stream: 'All',
    className: '',
    sectionName: '',
    batchName: '',
    personId: '',
    biometricUserId: ''
  };

  constructor(
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initWebhookUrl();
    this.loadDevices();
    this.loadEvents();
    this.loadMappings();
    this.loadPagedMappings();
    this.startLiveSync();

    this.filterSubscription = this.filterForm.valueChanges
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
      )
      .subscribe(() => {
        this.pageIndex = 0;
        this.loadPagedMappings();
      });
  }

  private initWebhookUrl(): void {
    let rawWebhook = (typeof window !== 'undefined' && (window as any).__env?.BIOMETRIC_WEBHOOK_URL)
      || environment.biometricWebhookUrl
      || `${environment.apiUrl}/attendance/biometric/hikvision`;

    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocal) {
        // In Production on live domain/VPS, automatically resolve to current live website origin
        if (rawWebhook.includes('localhost') || rawWebhook.includes('127.0.0.1')) {
          this.webhookUrl = `${window.location.origin}/api/attendance/biometric/hikvision`;
        } else {
          this.webhookUrl = rawWebhook;
        }
      } else {
        // In local development
        const host = window.location.hostname || 'localhost';
        this.webhookUrl = rawWebhook.replace('localhost', host);
      }
    } else {
      this.webhookUrl = rawWebhook;
    }
  }

  ngOnDestroy(): void {
    this.filterSubscription?.unsubscribe();
    if (this.liveSyncTimer) {
      clearInterval(this.liveSyncTimer);
    }
  }

  toggleLiveSync(): void {
    this.isLiveSync = !this.isLiveSync;
    if (this.isLiveSync) {
      this.loadEvents(true);
      this.startLiveSync();
    } else if (this.liveSyncTimer) {
      clearInterval(this.liveSyncTimer);
    }
  }

  startLiveSync(): void {
    if (this.liveSyncTimer) {
      clearInterval(this.liveSyncTimer);
    }
    // Polls / hits every 5 seconds for instant real-time punch discovery
    this.liveSyncTimer = setInterval(() => {
      if (this.isLiveSync) {
        this.loadEvents(true);
      }
    }, 5000);
  }

  copyWebhookUrl(): void {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(this.webhookUrl).then(() => {
        this.confirmDialog.alert('URL Copied', 'Hikvision Webhook URL copied to clipboard.', 'success');
      });
    } else {
      this.confirmDialog.alert('Webhook URL', this.webhookUrl, 'info');
    }
  }

  prefillHikvision(): void {
    this.form = {
      name: 'Hikvision DS-K1A802AEF Terminal',
      brand: 'Hikvision',
      model: 'DS-K1A802AEF',
      serialNumber: '',
      ipAddress: '192.168.1.100',
      port: 80,
      connectionMode: 'ISAPI / HTTP Push',
      isActive: true
    };
  }

  loadDevices(): void {
    this.loading = true;
    this.http.get<Device[]>(`${this.api}/biometric-devices`).subscribe({
      next: data => { this.devices = data || []; this.loading = false; },
      error: () => this.loading = false
    });
  }

  loadEvents(silent = false): void {
    if (!silent) this.eventsLoading = true;
    this.http.get<EventLog[]>(`${this.api}/biometric-devices/events`).subscribe({
      next: data => {
        this.events = data || [];
        if (!silent) this.eventsLoading = false;
      },
      error: err => {
        if (!silent) {
          this.eventsLoading = false;
          const message = err?.error?.message || 'Could not refresh biometric events.';
          this.message = message;
          this.confirmDialog.alert('Refresh Events Failed', message, 'danger');
        }
      }
    });
  }

  activeCategory: 'Coaching' | 'School' | 'Teacher' = 'Coaching';

  get coachingCount(): number {
    return this.serverCoachingCount || this.people.filter(p => p.personType === 'Student' && (p.stream === 'Coaching' || p.stream === 'Both' || !!p.batchName)).length;
  }
  get schoolCount(): number {
    return this.serverSchoolCount || this.people.filter(p => p.personType === 'Student' && (p.stream === 'School' || p.stream === 'Both' || !!p.className)).length;
  }
  get teacherCount(): number {
    return this.serverTeacherCount || this.people.filter(p => p.personType === 'Teacher').length;
  }

  setCategory(cat: 'Coaching' | 'School' | 'Teacher'): void {
    this.activeCategory = cat;
    this.mapping.personType = cat === 'Teacher' ? 'Teacher' : 'Student';
    this.mapping.stream = cat;
    this.mapping.className = '';
    this.mapping.sectionName = '';
    this.mapping.batchName = '';
    this.mapping.personId = '';
    this.mapping.biometricUserId = '';
    this.filterForm.reset({
      searchName: '',
      searchCode: '',
      searchGroup: '',
      mappingStatus: 'all'
    }, { emitEvent: false });
    this.pageIndex = 0;
    this.loadPagedMappings();
  }

  loadPagedMappings(): void {
    this.isMappingsLoading = true;
    const cat = this.activeCategory.toLowerCase();
    const { searchName, searchCode, searchGroup, mappingStatus } = this.filterForm.value;

    let params = new HttpParams()
      .set('category', cat)
      .set('sortBy', this.sortBy)
      .set('sortDir', this.sortDir)
      .set('page', (this.pageIndex + 1).toString())
      .set('pageSize', this.pageSize.toString());

    if (searchName?.trim()) params = params.set('searchName', searchName.trim());
    if (searchCode?.trim()) params = params.set('searchCode', searchCode.trim());
    if (searchGroup?.trim()) params = params.set('searchGroup', searchGroup.trim());
    if (mappingStatus && mappingStatus !== 'all') params = params.set('mappingStatus', mappingStatus);

    this.http.get<BiometricMappingPagedResult>(`${this.api}/attendance/mappings/paged`, { params }).subscribe({
      next: res => {
        this.pagedPeople = res.items || [];
        this.totalRecords = res.totalCount || 0;
        if (typeof res.pageNumber === 'number' && res.pageNumber >= 1) {
          this.pageIndex = res.pageNumber - 1;
        }
        this.serverCoachingCount = res.coachingCount ?? 0;
        this.serverSchoolCount = res.schoolCount ?? 0;
        this.serverTeacherCount = res.teacherCount ?? 0;
        this.isMappingsLoading = false;
      },
      error: err => {
        this.isMappingsLoading = false;
        if (this.people.length) {
          this.pagedPeople = this.filteredPeople.slice(this.pageIndex * this.pageSize, (this.pageIndex + 1) * this.pageSize);
          this.totalRecords = this.filteredPeople.length;
        } else {
          this.confirmDialog.alert('Mapping Load Failed', err?.error?.message || 'Could not load biometric mappings.', 'danger');
        }
      }
    });
  }

  onSortChange(sort: Sort): void {
    this.sortBy = sort.active || 'name';
    this.sortDir = (sort.direction as 'asc' | 'desc') || 'asc';
    this.pageIndex = 0;
    this.loadPagedMappings();
  }

  onPageChange(event: PageEvent): void {
    if (event.pageSize !== this.pageSize) {
      this.pageSize = event.pageSize;
      this.pageIndex = 0;
    } else {
      this.pageIndex = event.pageIndex;
    }
    this.loadPagedMappings();
  }

  clearFilterField(field: 'searchName' | 'searchCode' | 'searchGroup'): void {
    this.filterForm.get(field)?.setValue('');
  }

  resetFilters(): void {
    this.filterForm.reset({
      searchName: '',
      searchCode: '',
      searchGroup: '',
      mappingStatus: 'all'
    });
    this.sortBy = 'name';
    this.sortDir = 'asc';
    this.pageIndex = 0;
    this.loadPagedMappings();
  }

  isHybrid(p: MappingPerson): boolean {
    return p.stream === 'Both' || (Boolean(p.className) && Boolean(p.batchName));
  }

  get classNames(): string[] {
    return Array.from(
      new Set(
        this.people
          .filter(person => person.personType === 'Student' && person.className)
          .map(person => person.className!)
      )
    ).sort();
  }

  get sectionNames(): string[] {
    return Array.from(
      new Set(
        this.people
          .filter(person => person.personType === 'Student' && (!this.mapping.className || person.className === this.mapping.className) && person.sectionName)
          .map(person => person.sectionName!)
      )
    ).sort();
  }

  get batchNames(): string[] {
    return Array.from(
      new Set(
        this.people
          .filter(person => person.personType === 'Student' && person.batchName)
          .map(person => person.batchName!)
      )
    ).sort();
  }

  get filteredPeople(): MappingPerson[] {
    return this.people.filter(person => {
      if (this.activeCategory === 'Teacher') {
        return person.personType === 'Teacher';
      }

      if (person.personType !== 'Student') return false;

      if (this.activeCategory === 'Coaching') {
        const isCoaching = person.stream === 'Coaching' || person.stream === 'Both' || !!person.batchName;
        if (!isCoaching) return false;
        if (this.mapping.batchName && person.batchName !== this.mapping.batchName) return false;
        return true;
      }

      if (this.activeCategory === 'School') {
        const isSchool = person.stream === 'School' || person.stream === 'Both' || !!person.className;
        if (!isSchool) return false;
        if (this.mapping.className && person.className !== this.mapping.className) return false;
        if (this.mapping.sectionName && person.sectionName !== this.mapping.sectionName) return false;
        return true;
      }

      return true;
    });
  }

  getAffiliationLabel(person: MappingPerson): string {
    if (person.personType === 'Teacher') return '';
    const parts: string[] = [];
    if (person.className) {
      parts.push(`Class: ${person.className}${person.sectionName ? ' - ' + person.sectionName : ''}`);
    }
    if (person.batchName) {
      parts.push(`Batch: ${person.batchName}`);
    }
    return parts.length ? ' · ' + parts.join(' | ') : '';
  }

  onMappingTypeChanged(): void {
    this.mapping.stream = 'All';
    this.mapping.className = '';
    this.mapping.sectionName = '';
    this.mapping.batchName = '';
    this.mapping.personId = '';
    this.mapping.biometricUserId = '';
  }

  onClassChange(): void {
    this.mapping.sectionName = '';
    this.onFilterChange();
  }

  onFilterChange(): void {
    if (this.activeCategory === 'Coaching') {
      this.filterForm.get('searchGroup')?.setValue(this.mapping.batchName || '');
    } else if (this.activeCategory === 'School') {
      const clsSec = [this.mapping.className, this.mapping.sectionName].filter(Boolean).join(' ');
      this.filterForm.get('searchGroup')?.setValue(clsSec);
    }
  }

  showManualEdit = false;
  selectedPersonName = '';

  toggleManualEdit(): void {
    this.showManualEdit = !this.showManualEdit;
    if (!this.showManualEdit) {
      this.closeManualEdit();
    }
  }

  closeManualEdit(): void {
    this.showManualEdit = false;
    this.mapping.personId = '';
    this.mapping.biometricUserId = '';
    this.selectedPersonName = '';
  }

  selectPersonForEdit(p: MappingPerson): void {
    this.mapping.personId = p.id;
    this.mapping.biometricUserId = p.biometricUserId || p.suggestedBiometricId || '';
    this.selectedPersonName = `${p.name} (${p.code}${this.getAffiliationLabel(p)})`;
    this.showManualEdit = true;
    if (this.activeCategory === 'Coaching' && p.batchName) {
      this.mapping.batchName = p.batchName;
    }
    if (this.activeCategory === 'School') {
      if (p.className) this.mapping.className = p.className;
      if (p.sectionName) this.mapping.sectionName = p.sectionName;
    }
  }

  onPersonSelected(): void {
    const person = this.pagedPeople.find(p => p.id === this.mapping.personId) || this.people.find(p => p.id === this.mapping.personId);
    if (person) {
      this.mapping.biometricUserId = person.biometricUserId || person.suggestedBiometricId || '';
      this.selectedPersonName = `${person.name} (${person.code}${this.getAffiliationLabel(person)})`;
    }
  }

  loadMappings(): void {
    this.http.get<MappingPerson[]>(`${this.api}/attendance/mappings`).subscribe({
      next: data => this.people = data || [],
      error: err => this.confirmDialog.alert('Mapping Load Failed', err?.error?.message || 'Could not load students and teachers.', 'danger')
    });
  }

  saveMapping(): void {
    const person = this.pagedPeople.find(x => x.id === this.mapping.personId) || this.people.find(x => x.id === this.mapping.personId);
    if (!person) return;
    const newId = this.mapping.biometricUserId.trim();
    if (!newId) return;
    this.http.put(`${this.api}/attendance/mappings/${person.personType.toLowerCase()}/${person.id}`, { biometricUserId: newId }).subscribe({
      next: () => {
        person.biometricUserId = newId;
        this.confirmDialog.alert('Mapping Saved', `${person.personType} "${person.name}" biometric mapping updated (${newId}).`, 'success');
        this.closeManualEdit();
        this.loadPagedMappings();
      },
      error: err => this.confirmDialog.alert('Mapping Failed', err?.error?.message || 'Could not save biometric mapping.', 'danger')
    });
  }

  quickAssignSuggested(person: MappingPerson): void {
    if (!person.suggestedBiometricId) return;
    const newId = person.suggestedBiometricId.trim();
    this.http.put(`${this.api}/attendance/mappings/${person.personType.toLowerCase()}/${person.id}`, { biometricUserId: newId }).subscribe({
      next: () => {
        person.biometricUserId = newId;
        this.confirmDialog.alert('Device ID Assigned', `Assigned unique biometric ID ${newId} to ${person.name}.`, 'success');
        this.loadPagedMappings();
      },
      error: err => this.confirmDialog.alert('Assignment Failed', err?.error?.message || 'Could not assign biometric ID.', 'danger')
    });
  }

  get isAdminEnrolled(): boolean {
    const user = this.authService.currentUser();
    const currentName = user?.fullName?.trim().toLowerCase();
    if (!currentName) return false;
    return this.pagedPeople.some(p => p.personType === 'Teacher' && (p.name?.trim().toLowerCase() === currentName || (p.code && p.code.startsWith('ADM-'))))
      || this.people.some(p => p.personType === 'Teacher' && (p.name?.trim().toLowerCase() === currentName || (p.code && p.code.startsWith('ADM-'))));
  }

  enrollingAdmin = false;

  enrollAdminAsStaff(): void {
    if (this.isAdminEnrolled) {
      this.confirmDialog.alert('Administrator Already Enrolled', 'Your administrator profile is already enrolled in the Staff directory with a Biometric Device ID.', 'info');
      return;
    }

    this.confirmDialog.confirm(
      'Enroll Administrator as Staff',
      'This will create an official Staff profile for your Administrator account (Principal / Management) and assign a unique Biometric Device ID for machine punches. Proceed?'
    ).subscribe(ok => {
      if (!ok) return;
      this.enrollingAdmin = true;
      this.http.post<any>(`${this.api}/attendance/mappings/enroll-admin`, {}).subscribe({
        next: res => {
          this.enrollingAdmin = false;
          this.confirmDialog.alert('Enrollment Successful', res?.message || 'Administrator successfully enrolled with Biometric Device ID.', 'success');
          this.loadMappings();
          this.loadPagedMappings();
        },
        error: err => {
          // If enroll-admin endpoint returned 404/405 (e.g. backend process not restarted yet), fallback via live Teachers API
          this.fallbackEnrollViaTeachers(err);
        }
      });
    });
  }

  private fallbackEnrollViaTeachers(primaryErr?: any): void {
    const user = this.authService.currentUser();
    const usedIds = new Set(this.people.map(p => p.biometricUserId?.trim()).filter(Boolean));
    let candidate = 9001;
    while (usedIds.has(candidate.toString())) {
      candidate++;
    }
    const bioId = candidate.toString();
    const teacherCount = this.people.filter(p => p.personType === 'Teacher').length;
    const empCode = `ADM-${String(teacherCount + 1).padStart(3, '0')}`;

    const phone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const email = user?.username?.includes('@') ? user.username : undefined;

    const payload: any = {
      employeeCode: empCode,
      fullName: user?.fullName || 'Administrator',
      gender: 'Male',
      phoneNumber: phone,
      email: email,
      designation: 'Principal / Administrator',
      department: 'Administration & Management',
      staffType: 'NonTeaching',
      joiningDate: new Date().toISOString(),
      isActive: true,
      biometricUserId: bioId
    };

    this.http.post<any>(`${this.api}/teachers`, payload).subscribe({
      next: () => {
        this.enrollingAdmin = false;
        this.confirmDialog.alert(
          'Enrollment Successful',
          `Administrator "${payload.fullName}" successfully enrolled as Staff (Principal / Management) with Biometric Device ID ${bioId}.`,
          'success'
        );
        this.loadMappings();
        this.loadPagedMappings();
      },
      error: err2 => {
        this.enrollingAdmin = false;
        const msg = err2?.error?.message || primaryErr?.error?.message || 'Could not enroll administrator as staff.';
        this.confirmDialog.alert('Enrollment Failed', msg, 'danger');
      }
    });
  }

  autoGenerating = false;

  autoGenerateIds(overwrite = false): void {
    this.autoGenerating = true;
    const category = this.activeCategory.toLowerCase();
    this.http.post<{ message: string; updatedCount: number }>(`${this.api}/attendance/mappings/auto-generate`, { category, overwriteExisting: overwrite }).subscribe({
      next: res => {
        this.autoGenerating = false;
        this.loadMappings();
        this.loadPagedMappings();
        this.confirmDialog.alert('Auto-Generation Complete', res.message || 'Biometric device IDs auto-generated.', 'success');
      },
      error: err => {
        this.autoGenerating = false;
        this.confirmDialog.alert('Generation Failed', err?.error?.message || 'Could not auto-generate biometric IDs.', 'danger');
      }
    });
  }

  get enrolledInPageCount(): number {
    return this.pagedPeople.filter(p => p.isThumbEnrolled).length;
  }

  getThumbTooltip(p: MappingPerson): string {
    if (p.isThumbEnrolled) {
      if (p.lastBiometricPunchAt) {
        const raw = p.lastBiometricPunchAt.endsWith('Z') ? p.lastBiometricPunchAt : `${p.lastBiometricPunchAt}Z`;
        const dt = new Date(raw);
        if (!isNaN(dt.getTime())) {
          const istStr = dt.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          });
          return `Thumb Enrolled ✓ (Verified: ${istStr} IST) · Click to unmark`;
        }
      }
      return 'Thumb Enrolled ✓ on Biometric Machine · Click to unmark';
    }
    return 'Click to mark Thumb [✓] as enrolled on Biometric Machine';
  }

  toggleThumbEnrollment(p: MappingPerson): void {
    const bioId = (p.biometricUserId || p.suggestedBiometricId || '').trim();
    if (!bioId) {
      this.confirmDialog.alert('Biometric ID Required', `Please assign a Biometric Device ID for "${p.name}" first.`, 'warning');
      return;
    }

    const nextState = !p.isThumbEnrolled;
    this.http.post<{ enrolled: boolean; biometricUserId: string; lastBiometricPunchAt?: string }>(
      `${this.api}/attendance/mappings/${p.personType.toLowerCase()}/${p.id}/toggle-thumb`,
      { enrolled: nextState, biometricUserId: bioId }
    ).subscribe({
      next: res => {
        p.isThumbEnrolled = res.enrolled;
        if (res.biometricUserId) {
          p.biometricUserId = res.biometricUserId;
        }
        p.lastBiometricPunchAt = res.lastBiometricPunchAt || undefined;

        const match = this.people.find(x => x.id === p.id);
        if (match) {
          match.isThumbEnrolled = p.isThumbEnrolled;
          match.biometricUserId = p.biometricUserId;
          match.lastBiometricPunchAt = p.lastBiometricPunchAt;
        }
      },
      error: err => {
        this.confirmDialog.alert('Update Failed', err?.error?.message || 'Could not update thumb enrollment status.', 'danger');
      }
    });
  }

  printEnrollmentSheet(): void {
    const list = this.pagedPeople.length ? this.pagedPeople : this.filteredPeople;
    if (!list.length) {
      this.confirmDialog.alert('Print Notice', 'No persons to print in current category/filter.', 'warning');
      return;
    }

    const title = `Hikvision Biometric & RFID Enrollment Checklist - ${this.activeCategory} (${list.length})`;
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const enrolledCount = list.filter(x => x.isThumbEnrolled).length;
    const pendingCount = list.length - enrolledCount;

    let rowsHtml = '';
    list.forEach((p, index) => {
      const codeOrRoll = p.code || '—';
      const affiliation = p.batchName ? `Batch: ${p.batchName}` : (p.className ? `Class: ${p.className}${p.sectionName ? ' - ' + p.sectionName : ''}` : 'Faculty');
      const deviceId = p.biometricUserId || p.suggestedBiometricId || '—';
      const statusBadge = p.biometricUserId ? '<span style="color:#15803d; font-weight:bold;">[MAPPED]</span>' : '<span style="color:#b45309;">[SUGGESTED]</span>';
      const thumbCell = p.isThumbEnrolled
        ? '<td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1; font-size: 14px; font-weight: 800; color: #15803d; background: #f0fdf4;">[ &#10003; ]</td>'
        : '<td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1; font-size: 15px; color: #475569;">[ &nbsp; ]</td>';

      rowsHtml += `
        <tr>
          <td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1;">${index + 1}</td>
          <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${p.name}</td>
          <td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1;">${codeOrRoll}</td>
          <td style="padding: 7px 6px; border: 1px solid #cbd5e1;">${affiliation}</td>
          <td style="text-align:center; padding: 7px 6px; border: 1px solid #cbd5e1; font-size: 14px; font-weight: bold; color: #1e3a8a;">
            ${deviceId} <small style="font-size: 10px; font-weight: normal; margin-left: 4px;">${statusBadge}</small>
          </td>
          ${thumbCell}
          <td style="padding: 7px 6px; border: 1px solid #cbd5e1; color: #94a3b8;">____________________</td>
        </tr>
      `;
    });

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 8px; color: #0f172a; font-size: 11px; }
          .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
          .header h2 { margin: 0 0 4px 0; color: #1e3a8a; font-size: 16px; text-transform: uppercase; }
          .header p { margin: 0; color: #475569; font-size: 11px; }
          .instructions { background: #f1f5f9; padding: 6px 10px; border-radius: 4px; margin-bottom: 10px; font-size: 10.5px; border-left: 3px solid #2563eb; }
          table { width: 100%; border-collapse: collapse; margin-top: 6px; }
          th { background: #e2e8f0; color: #1e293b; font-weight: 700; padding: 7px 5px; border: 1px solid #cbd5e1; font-size: 10.5px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer { margin-top: 16px; display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${title}</h2>
          <p>Generated on ${dateStr} (IST) · Device Model: Hikvision DS-K1A802AEF</p>
        </div>
        <div class="instructions">
          <strong>Staff Enrollment Checklist:</strong> 
          1. Go to Biometric Machine &gt; Add User &gt; Enter <strong>Biometric Device ID</strong>. 
          2. Scan student's thumb or tap EM-125kHz RFID card. 
          3. Tick [✓] for thumb or write down the 10-digit Card Number.
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>Full Name</th>
              <th style="width: 75px;">Roll / Code</th>
              <th style="width: 125px;">Class / Batch</th>
              <th style="width: 130px;">Biometric Device ID</th>
              <th style="width: 60px;">Thumb [✓]</th>
              <th style="width: 135px;">RFID Card Number</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          <span>Total Persons: ${list.length} · Thumb Enrolled [✓]: <strong style="color:#15803d;">${enrolledCount}</strong> · Pending [ ]: <strong>${pendingCount}</strong></span>
          <span>Verified By (Operator Signature): ______________________________</span>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  }

  retryEvent(event: EventLog): void {
    this.http.post(`${this.api}/attendance/biometric-events/${event.id}/retry`, {}).subscribe({
      next: response => {
        this.confirmDialog.alert('Event Retried', (response as any)?.message || 'Biometric event processed.', 'success');
        this.loadEvents();
      },
      error: err => this.confirmDialog.alert('Retry Failed', err?.error?.message || 'Could not retry biometric event.', 'danger')
    });
  }

  saveDevice(): void {
    const request = this.editingId ? this.http.put(`${this.api}/biometric-devices/${this.editingId}`, this.form) : this.http.post(`${this.api}/biometric-devices`, this.form);
    request.subscribe({
      next: () => {
        this.cancelForm();
        this.loadDevices();
        this.confirmDialog.alert('Device Saved', 'Biometric device configuration saved successfully.', 'success');
      },
      error: err => {
        const message = err?.error?.message || 'Could not save device.';
        this.message = message;
        this.confirmDialog.alert('Device Save Failed', message, 'danger');
      }
    });
  }

  editDevice(device: Device): void {
    this.editingId = device.id;
    this.form = {
      name: device.name,
      brand: device.brand || '',
      model: device.model || '',
      serialNumber: device.serialNumber || '',
      ipAddress: device.ipAddress || '',
      port: device.port,
      connectionMode: device.connectionMode,
      isActive: device.isActive
    };
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingId = '';
    this.form = { name: '', brand: '', model: '', serialNumber: '', ipAddress: '', port: 80, connectionMode: 'PendingAdapter', isActive: true };
  }

  testConnection(device: Device): void {
    this.http.post<Device>(`${this.api}/biometric-devices/${device.id}/test-connection`, {}).subscribe({
      next: updated => {
        Object.assign(device, updated);
        this.confirmDialog.alert('Connection Test', updated.status === 'AdapterRequired' ? 'Device saved, but the vendor SDK/API adapter is still required.' : `Device status: ${updated.status}`, updated.status === 'Online' ? 'success' : 'warning');
      },
      error: err => {
        const message = err?.error?.message || 'Connection test failed.';
        this.message = message;
        this.confirmDialog.alert('Connection Test Failed', message, 'danger');
      }
    });
  }

  simulatePunch(): void {
    this.simulating = true;
    const resolvedPersonType = this.simulation.personType === 'Teacher' ? 'Teacher' : 'Student';
    this.http.post<any>(`${this.api}/attendance/biometric-events`, {
      personType: resolvedPersonType,
      biometricUserId: this.simulation.biometricUserId,
      eventTime: new Date().toISOString(),
      deviceId: this.simulation.deviceId || null,
      eventId: this.simulation.eventId || `SIM-${Date.now()}`,
      isCheckOut: false
    }).subscribe({
      next: response => {
        this.message = response?.message || 'Punch captured.';
        this.simulating = false;
        this.loadEvents();
        this.loadPagedMappings();
        this.loadMappings();
        this.confirmDialog.alert('Biometric Punch Captured', response?.message || 'Attendance was created successfully.', 'success');
      },
      error: err => {
        const message = err?.error?.message || 'Punch failed.';
        this.message = message;
        this.simulating = false;
        this.loadEvents();
        this.confirmDialog.alert('Biometric Punch Failed', message, 'danger');
      }
    });
  }
}
