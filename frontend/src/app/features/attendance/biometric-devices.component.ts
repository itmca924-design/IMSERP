import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
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
}

@Component({
  selector: 'app-biometric-devices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
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
      <button mat-stroked-button color="primary" (click)="prefillHikvision(); showForm = true">
        <mat-icon>settings_suggest</mat-icon> Add Hikvision Device
      </button>
      <button mat-raised-button color="primary" (click)="showForm = !showForm">
        <mat-icon>add</mat-icon> {{ showForm ? 'Close Form' : 'Register Custom Device' }}
      </button>
    </div>
  </div>

  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

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
        <button mat-flat-button color="primary" (click)="copyWebhookUrl()" matTooltip="Copy Webhook URL">
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
      <button mat-stroked-button (click)="loadMappings()"><mat-icon>refresh</mat-icon> Refresh People</button>
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
          <span class="count-badge" *ngIf="coachingCount > 0">{{ coachingCount }}</span>
        </button>

        <button type="button" class="pill-btn" [class.active]="activeCategory === 'School'" (click)="setCategory('School')">
          <mat-icon class="pill-icon">school</mat-icon>
          <div class="pill-info">
            <span class="pill-title">School Students</span>
            <small class="pill-sub">Class &amp; Section-wise Enrollment</small>
          </div>
          <span class="count-badge" *ngIf="schoolCount > 0">{{ schoolCount }}</span>
        </button>

        <button type="button" class="pill-btn" [class.active]="activeCategory === 'Teacher'" (click)="setCategory('Teacher')">
          <mat-icon class="pill-icon">badge</mat-icon>
          <div class="pill-info">
            <span class="pill-title">Teachers &amp; Faculty</span>
            <small class="pill-sub">Staff Fingerprint &amp; RFID Cards</small>
          </div>
          <span class="count-badge" *ngIf="teacherCount > 0">{{ teacherCount }}</span>
        </button>
      </div>
    </div>

    <!-- Clean Filter Bar (Batch / Class / Section) -->
    <div class="filter-deck">
      <!-- Coaching Batch Filter -->
      <mat-form-field appearance="outline" *ngIf="activeCategory === 'Coaching'" class="filter-field">
        <mat-label>Coaching Batch</mat-label>
        <mat-select [(ngModel)]="mapping.batchName" (selectionChange)="onFilterChange()">
          <mat-option value="">All Coaching Batches ({{ coachingCount }})</mat-option>
          <mat-option *ngFor="let batch of batchNames" [value]="batch">{{ batch }}</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- School Class & Section Filters -->
      <ng-container *ngIf="activeCategory === 'School'">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>School Class</mat-label>
          <mat-select [(ngModel)]="mapping.className" (selectionChange)="onClassChange()">
            <mat-option value="">All Classes ({{ schoolCount }})</mat-option>
            <mat-option *ngFor="let cls of classNames" [value]="cls">{{ cls }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Section</mat-label>
          <mat-select [(ngModel)]="mapping.sectionName" (selectionChange)="onFilterChange()">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let sec of sectionNames" [value]="sec">{{ sec }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <button mat-stroked-button color="primary" class="toggle-edit-btn" (click)="toggleManualEdit()" *ngIf="!showManualEdit">
        <mat-icon>edit_note</mat-icon> Custom / RFID Card Entry
      </button>
    </div>

    <!-- Collapsible Single Mapping Box (Visible ONLY when user clicks Edit or Custom) -->
    <div class="manual-edit-panel" *ngIf="showManualEdit">
      <div class="edit-panel-header">
        <div class="panel-title-wrap">
          <mat-icon class="panel-icon">edit</mat-icon>
          <div>
            <h4>{{ selectedPersonName ? 'Assign Biometric ID: ' + selectedPersonName : 'Manual Biometric / RFID Card Entry' }}</h4>
            <small>Type numeric ID or scan/tap 125kHz RFID card. Save button activates when ID is typed.</small>
          </div>
        </div>
        <button mat-icon-button (click)="closeManualEdit()" matTooltip="Close editor">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="edit-panel-body">
        <!-- Person Selector (if not already picked via table edit) -->
        <mat-form-field appearance="outline" class="edit-field" *ngIf="!selectedPersonName">
          <mat-label>Select Person</mat-label>
          <mat-select [(ngModel)]="mapping.personId" (selectionChange)="onPersonSelected()">
            <mat-option *ngFor="let person of filteredPeople" [value]="person.id">
              {{ person.name }} ({{ person.code }}{{ getAffiliationLabel(person) }})
            </mat-option>
          </mat-select>
        </mat-form-field>

        <!-- Biometric User ID / RFID Card Input (Green Box) -->
        <mat-form-field appearance="outline" class="edit-field" [class.field-has-value]="mapping.biometricUserId.trim()">
          <mat-label>Biometric User ID / RFID Card No</mat-label>
          <input matInput [(ngModel)]="mapping.biometricUserId" placeholder="e.g. 101 or Card 0001234567">
          <mat-icon matSuffix class="input-suffix-icon" *ngIf="mapping.biometricUserId.trim()">check_circle</mat-icon>
          <mat-hint>Enter ID to activate the Save Mapping button</mat-hint>
        </mat-form-field>

        <!-- Save Button (Red Mark): ONLY VISIBLE & ACTIVE WHEN TEXT IS IN THE GREEN BOX! -->
        <div class="edit-actions">
          <button mat-raised-button color="primary" class="save-mapping-btn" 
                  *ngIf="mapping.personId && mapping.biometricUserId.trim()" 
                  (click)="saveMapping()">
            <mat-icon>save</mat-icon> Save Mapping
          </button>
          <button mat-stroked-button (click)="closeManualEdit()">
            Cancel
          </button>
        </div>
      </div>
    </div>

    <!-- Enrollment Directory Toolbar -->
    <div class="directory-toolbar">
      <div class="toolbar-info">
        <h3>
          <mat-icon class="dir-icon">contacts</mat-icon>
          {{ activeCategory }} Enrollment Directory ({{ filteredPeople.length }})
        </h3>
        <p>Pre-calculated unique biometric device IDs for Hikvision DS-K1A802AEF enrollment and 125kHz RFID card assignment.</p>
      </div>
      <div class="toolbar-actions">
        <button mat-flat-button color="accent" (click)="autoGenerateIds(false)" [disabled]="autoGenerating" matTooltip="Auto-generate and save unique device IDs in database for all unmapped people in this category">
          <mat-icon>{{ autoGenerating ? 'hourglass_top' : 'auto_fix_high' }}</mat-icon>
          {{ autoGenerating ? 'Generating...' : '⚡ Auto-Generate All IDs' }}
        </button>
        <button mat-stroked-button color="primary" (click)="printEnrollmentSheet()" matTooltip="Print physical checklist to carry to the biometric machine">
          <mat-icon>print</mat-icon> Print Enrollment Sheet
        </button>
      </div>
    </div>

    <!-- Responsive Enrollment Table -->
    <div class="table-responsive">
      <table class="enroll-table">
        <thead>
          <tr>
            <th class="col-sno">#</th>
            <th class="col-name">Name</th>
            <th class="col-code">{{ activeCategory === 'Teacher' ? 'Emp Code' : (activeCategory === 'Coaching' ? 'Coaching Roll' : 'Roll No') }}</th>
            <th class="col-group">{{ activeCategory === 'Teacher' ? 'Staff' : (activeCategory === 'Coaching' ? 'Coaching Batch' : 'Class & Section') }}</th>
            <th class="col-device-id">Biometric Device ID</th>
            <th class="col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let p of filteredPeople; let i = index" [class.unmapped-row]="!p.biometricUserId">
            <td class="col-sno">{{ i + 1 }}</td>
            <td class="col-name">
              <strong>{{ p.name }}</strong>
            </td>
            <td class="col-code"><span class="badge-code">{{ p.code || '—' }}</span></td>
            <td class="col-group">
              <span class="group-badge batch" *ngIf="p.batchName">📚 {{ p.batchName }}</span>
              <span class="group-badge school" *ngIf="p.className">🏫 {{ p.className }}{{ p.sectionName ? ' - ' + p.sectionName : '' }}</span>
              <span class="group-badge teacher" *ngIf="p.personType === 'Teacher'">👨‍🏫 Faculty</span>
            </td>
            <td class="col-device-id">
              <span class="bio-tag mapped" *ngIf="p.biometricUserId" matTooltip="Mapped in Database">
                <mat-icon>fingerprint</mat-icon> {{ p.biometricUserId }}
              </span>
              <span class="bio-tag suggested" *ngIf="!p.biometricUserId && p.suggestedBiometricId" matTooltip="Auto-generated suggested ID">
                <mat-icon>lightbulb</mat-icon> Suggested: <strong>{{ p.suggestedBiometricId }}</strong>
              </span>
              <span class="bio-tag unmapped" *ngIf="!p.biometricUserId && !p.suggestedBiometricId">
                <mat-icon>warning</mat-icon> Unmapped
              </span>
            </td>
            <td class="col-action">
              <button mat-stroked-button color="accent" class="btn-xs" *ngIf="!p.biometricUserId && p.suggestedBiometricId" (click)="quickAssignSuggested(p)" matTooltip="Assign this ID in DB now">
                <mat-icon>check_circle</mat-icon> Apply {{ p.suggestedBiometricId }}
              </button>
              <button mat-icon-button class="btn-icon-xs" (click)="selectPersonForEdit(p)" matTooltip="Select for Edit">
                <mat-icon>edit</mat-icon>
              </button>
            </td>
          </tr>
          <tr *ngIf="!filteredPeople.length">
            <td colspan="6" class="empty-cell">No {{ activeCategory.toLowerCase() }} found matching current filters.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </mat-card>

  <mat-card *ngIf="showForm" class="form-card">
    <div class="form-card-header">
      <h2>{{ editingId ? 'Edit Device Configuration' : 'Register Biometric / RFID Terminal' }}</h2>
      <button mat-stroked-button color="accent" (click)="prefillHikvision()" *ngIf="!editingId">
        <mat-icon>auto_fix_high</mat-icon> Auto-Fill DS-K1A802AEF Defaults
      </button>
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
      <button mat-button (click)="cancelForm()">Cancel</button>
      <button mat-raised-button color="primary" (click)="saveDevice()" [disabled]="!form.name">Save Device</button>
    </div>
  </mat-card>

  <div class="device-grid">
    <mat-card *ngFor="let device of devices" class="device-card">
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
      <small *ngIf="device.lastError" class="error">{{device.lastError}}</small>
      <div class="actions">
        <button mat-stroked-button color="primary" (click)="testConnection(device)">
          <mat-icon>sync</mat-icon> Test Socket Connection
        </button>
        <button mat-icon-button (click)="editDevice(device)" matTooltip="Edit device">
          <mat-icon>edit</mat-icon>
        </button>
      </div>
    </mat-card>
    <mat-card *ngIf="!devices.length" class="empty">
      <mat-icon>devices_other</mat-icon>
      <p>No biometric devices registered yet. Click "Add Hikvision Device" above to register your terminal.</p>
    </mat-card>
  </div>

  <mat-card class="simulation-card">
    <div class="section-heading">
      <div>
        <h2>Test Punch Simulation</h2>
        <p>Instantly test fingerprint or RFID punches to verify live Check-In &amp; Check-Out behavior in IST.</p>
      </div>
      <button mat-stroked-button (click)="loadEvents()" [disabled]="eventsLoading">
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
          <mat-option *ngFor="let device of devices" [value]="device.id">{{device.name}}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>
    <div class="actions">
      <button mat-raised-button color="primary" (click)="simulatePunch()" [disabled]="!simulation.biometricUserId || simulating">
        <mat-icon>fingerprint</mat-icon> Trigger Live Punch
      </button>
      <span class="message" *ngIf="message">{{message}}</span>
    </div>
  </mat-card>

  <mat-card class="events-card">
    <div class="section-heading">
      <div>
        <h2>Recent Biometric &amp; RFID Events <small>(IST - Asia/Kolkata)</small></h2>
        <p>Live stream of attendance punches (Auto-polling every 5 seconds).</p>
      </div>
      <div class="events-actions">
        <button mat-stroked-button (click)="toggleLiveSync()" [class.live-active]="isLiveSync" matTooltip="Toggle 5-second automatic polling">
          <mat-icon>{{ isLiveSync ? 'sync' : 'sync_disabled' }}</mat-icon>
          {{ isLiveSync ? 'Live Sync Active (5s)' : 'Live Sync Paused' }}
        </button>
        <button mat-stroked-button (click)="loadEvents()" [disabled]="eventsLoading">
          <mat-icon>{{eventsLoading ? 'sync' : 'refresh'}}</mat-icon> Refresh
        </button>
      </div>
    </div>
    <div class="event-row" *ngFor="let event of events">
      <span class="event-icon"><mat-icon>fingerprint</mat-icon></span>
      <div>
        <strong>{{event.personType}} / {{event.biometricUserId}}</strong>
        <small>{{event.eventTime | localDatetime:'datetime'}} · {{event.deviceEventId || 'No event ID'}}</small>
        <small class="event-error" *ngIf="event.errorMessage">{{event.errorMessage}}</small>
      </div>
      <span class="event-status" [class.processed]="event.status === 'Processed'" [class.failed]="event.status === 'Failed'">{{event.status}}</span>
      <button mat-icon-button *ngIf="event.status === 'Failed'" (click)="retryEvent(event)" matTooltip="Retry failed event">
        <mat-icon>replay</mat-icon>
      </button>
    </div>
    <p class="empty-text" *ngIf="!events.length">No biometric events received yet.</p>
  </mat-card>
</div>`,
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
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}
.page-header p, .section-heading p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.9rem;
}
.header-actions {
  display: flex;
  gap: 10px;
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
  margin-top: 2px;
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
  margin-bottom: 18px;
}
.category-pills {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.pill-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  text-align: left;
  position: relative;
}
.pill-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}
.pill-btn.active {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border-color: #2563eb;
  box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);
}
.pill-icon {
  font-size: 28px;
  width: 28px;
  height: 28px;
  color: #64748b;
}
.pill-btn.active .pill-icon {
  color: #2563eb;
}
.pill-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}
.pill-title {
  font-size: 0.96rem;
  font-weight: 700;
  color: #1e293b;
}
.pill-btn.active .pill-title {
  color: #1e40af;
}
.pill-sub {
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 2px;
}
.pill-btn.active .pill-sub {
  color: #3b82f6;
}
.count-badge {
  background: #e2e8f0;
  color: #475569;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 700;
}
.pill-btn.active .count-badge {
  background: #2563eb;
  color: #ffffff;
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
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.table-responsive {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  margin-top: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.enroll-table {
  width: 100%;
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
  width: 40px;
  color: #94a3b8;
  text-align: center;
}
.col-name strong {
  color: #0f172a;
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
.group-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}
.group-badge.batch {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.group-badge.school {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}
.group-badge.teacher {
  background: #faf5ff;
  color: #7e22ce;
  border: 1px solid #e9d5ff;
}
.bio-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
}
.bio-tag mat-icon {
  font-size: 16px;
  width: 16px;
  height: 16px;
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
  width: 32px;
  height: 32px;
  line-height: 32px;
  color: #64748b;
}
.btn-icon-xs mat-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
}
.empty-cell {
  text-align: center;
  padding: 30px;
  color: #64748b;
  font-style: italic;
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
.empty {
  text-align: center;
  padding: 36px;
  color: #64748b;
  grid-column: 1 / -1;
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
    align-items: flex-start;
    gap: 12px;
    flex-direction: column;
  }
  .webhook-code-row {
    flex-direction: column;
    align-items: stretch;
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

  constructor(private http: HttpClient, private confirmDialog: ConfirmDialogService) {}

  ngOnInit(): void {
    this.initWebhookUrl();
    this.loadDevices();
    this.loadEvents();
    this.loadMappings();
    this.startLiveSync();
  }

  private initWebhookUrl(): void {
    const rawWebhook = environment.biometricWebhookUrl || `${environment.apiUrl}/attendance/biometric/hikvision`;
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      // In local dev, if device needs LAN IP to reach PC, replace localhost with current hostname
      if (isLocal && rawWebhook.includes('localhost')) {
        const host = window.location.hostname || 'localhost';
        this.webhookUrl = rawWebhook.replace('localhost', host);
      } else {
        this.webhookUrl = rawWebhook;
      }
    } else {
      this.webhookUrl = rawWebhook;
    }
  }

  ngOnDestroy(): void {
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
    return this.people.filter(p => p.personType === 'Student' && (p.stream === 'Coaching' || p.stream === 'Both' || !!p.batchName)).length;
  }
  get schoolCount(): number {
    return this.people.filter(p => p.personType === 'Student' && (p.stream === 'School' || p.stream === 'Both' || !!p.className)).length;
  }
  get teacherCount(): number {
    return this.people.filter(p => p.personType === 'Teacher').length;
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
    const exists = this.filteredPeople.some(p => p.id === this.mapping.personId);
    if (!exists) {
      this.mapping.personId = '';
      this.mapping.biometricUserId = '';
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
    const person = this.people.find(p => p.id === this.mapping.personId);
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
    const person = this.people.find(x => x.id === this.mapping.personId);
    if (!person) return;
    const newId = this.mapping.biometricUserId.trim();
    if (!newId) return;
    this.http.put(`${this.api}/attendance/mappings/${person.personType.toLowerCase()}/${person.id}`, { biometricUserId: newId }).subscribe({
      next: () => {
        person.biometricUserId = newId;
        this.confirmDialog.alert('Mapping Saved', `${person.personType} "${person.name}" biometric mapping updated (${newId}).`, 'success');
        this.closeManualEdit();
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
      },
      error: err => this.confirmDialog.alert('Assignment Failed', err?.error?.message || 'Could not assign biometric ID.', 'danger')
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
        this.confirmDialog.alert('Auto-Generation Complete', res.message || 'Biometric device IDs auto-generated.', 'success');
      },
      error: err => {
        this.autoGenerating = false;
        this.confirmDialog.alert('Generation Failed', err?.error?.message || 'Could not auto-generate biometric IDs.', 'danger');
      }
    });
  }

  printEnrollmentSheet(): void {
    const list = this.filteredPeople;
    if (!list.length) {
      this.confirmDialog.alert('Print Notice', 'No persons to print in current category/filter.', 'warning');
      return;
    }

    const title = `Hikvision Biometric & RFID Enrollment Checklist - ${this.activeCategory} (${list.length})`;
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

    let rowsHtml = '';
    list.forEach((p, index) => {
      const codeOrRoll = p.code || '—';
      const affiliation = p.batchName ? `Batch: ${p.batchName}` : (p.className ? `Class: ${p.className}${p.sectionName ? ' - ' + p.sectionName : ''}` : 'Faculty');
      const deviceId = p.biometricUserId || p.suggestedBiometricId || '—';
      const statusBadge = p.biometricUserId ? '<span style="color:#15803d; font-weight:bold;">[MAPPED]</span>' : '<span style="color:#b45309;">[SUGGESTED]</span>';

      rowsHtml += `
        <tr>
          <td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1;">${index + 1}</td>
          <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 600;">${p.name}</td>
          <td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1;">${codeOrRoll}</td>
          <td style="padding: 7px 6px; border: 1px solid #cbd5e1;">${affiliation}</td>
          <td style="text-align:center; padding: 7px 6px; border: 1px solid #cbd5e1; font-size: 14px; font-weight: bold; color: #1e3a8a;">
            ${deviceId} <small style="font-size: 10px; font-weight: normal; margin-left: 4px;">${statusBadge}</small>
          </td>
          <td style="text-align:center; padding: 7px 5px; border: 1px solid #cbd5e1; font-size: 16px;">[ &nbsp; ]</td>
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
          <span>Total Persons: ${list.length}</span>
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
