import { Component, OnInit } from '@angular/core';
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
import { API_BASE } from '../teachers/teacher.models';
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
}

@Component({
  selector: 'app-biometric-devices',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatProgressBarModule, MatChipsModule, LocalDatetimePipe],
  template: `
<div class="page-container">
  <div class="page-header"><div><h1><mat-icon>fingerprint</mat-icon> Biometric Devices</h1><p>Configure device-ready attendance integration and monitor incoming biometric events.</p></div><button mat-raised-button color="primary" (click)="showForm = !showForm"><mat-icon>add</mat-icon> Add Device</button></div>
  <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>
  <mat-card class="notice"><mat-icon>info</mat-icon><span>Device-specific SDK/API adapter is pending until the brand and model are available. Simulation below validates the complete attendance flow now.</span></mat-card>
  <mat-card class="mapping-card">
    <div class="section-heading">
      <div>
        <h2>Biometric User Mapping</h2>
        <p>Assign the ID that the future device will send for each person (School Class & Coaching Batch-wise).</p>
      </div>
      <button mat-stroked-button (click)="loadMappings()"><mat-icon>refresh</mat-icon> Refresh People</button>
    </div>
    <div class="form-grid">
      <mat-form-field appearance="outline" [class.col-span-2]="mapping.personType === 'Teacher'">
        <mat-label>Person Type</mat-label>
        <mat-select [(ngModel)]="mapping.personType" (selectionChange)="onMappingTypeChanged()">
          <mat-option value="Student">Student</mat-option>
          <mat-option value="Teacher">Teacher</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" *ngIf="mapping.personType === 'Student'">
        <mat-label>Student Category</mat-label>
        <mat-select [(ngModel)]="mapping.stream" (selectionChange)="onFilterChange()">
          <mat-option value="All">All Categories</mat-option>
          <mat-option value="School">🏫 School Class</mat-option>
          <mat-option value="Coaching">📚 Coaching Batch</mat-option>
        </mat-select>
      </mat-form-field>

      <!-- School Class & Section Filters -->
      <ng-container *ngIf="mapping.personType === 'Student' && mapping.stream === 'School'">
        <mat-form-field appearance="outline">
          <mat-label>School Class</mat-label>
          <mat-select [(ngModel)]="mapping.className" (selectionChange)="onClassChange()">
            <mat-option value="">All Classes</mat-option>
            <mat-option *ngFor="let cls of classNames" [value]="cls">{{ cls }}</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Section</mat-label>
          <mat-select [(ngModel)]="mapping.sectionName" (selectionChange)="onFilterChange()">
            <mat-option value="">All Sections</mat-option>
            <mat-option *ngFor="let sec of sectionNames" [value]="sec">{{ sec }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <!-- Coaching Batch Filter -->
      <ng-container *ngIf="mapping.personType === 'Student' && mapping.stream === 'Coaching'">
        <mat-form-field appearance="outline" class="col-span-2">
          <mat-label>Coaching Batch</mat-label>
          <mat-select [(ngModel)]="mapping.batchName" (selectionChange)="onFilterChange()">
            <mat-option value="">All Batches</mat-option>
            <mat-option *ngFor="let batch of batchNames" [value]="batch">{{ batch }}</mat-option>
          </mat-select>
        </mat-form-field>
      </ng-container>

      <!-- Person Selector -->
      <mat-form-field appearance="outline">
        <mat-label>{{ mapping.personType === 'Student' ? 'Select Student (' + filteredPeople.length + ')' : 'Select Teacher (' + filteredPeople.length + ')' }}</mat-label>
        <mat-select [(ngModel)]="mapping.personId" (selectionChange)="onPersonSelected()">
          <mat-option *ngFor="let person of filteredPeople" [value]="person.id">
            {{ person.name }} ({{ person.code }}{{ getAffiliationLabel(person) }}) {{ person.biometricUserId ? '✓ [' + person.biometricUserId + ']' : '— [Unmapped]' }}
          </mat-option>
        </mat-select>
      </mat-form-field>

      <!-- Biometric User ID Input -->
      <mat-form-field appearance="outline">
        <mat-label>Biometric User ID</mat-label>
        <input matInput [(ngModel)]="mapping.biometricUserId" placeholder="e.g. STU-001">
        <mat-hint *ngIf="mapping.personId">Current mapped ID or enter a new one</mat-hint>
      </mat-form-field>

      <div class="actions">
        <button mat-raised-button color="primary" (click)="saveMapping()" [disabled]="!mapping.personId || !mapping.biometricUserId">Save Mapping</button>
      </div>
    </div>
  </mat-card>
  <mat-card *ngIf="showForm" class="form-card"><h2>{{ editingId ? 'Edit Device' : 'Register Device' }}</h2><div class="form-grid"><mat-form-field appearance="outline"><mat-label>Device Name</mat-label><input matInput [(ngModel)]="form.name"></mat-form-field><mat-form-field appearance="outline"><mat-label>Brand</mat-label><input matInput [(ngModel)]="form.brand"></mat-form-field><mat-form-field appearance="outline"><mat-label>Model</mat-label><input matInput [(ngModel)]="form.model"></mat-form-field><mat-form-field appearance="outline"><mat-label>Serial Number</mat-label><input matInput [(ngModel)]="form.serialNumber"></mat-form-field><mat-form-field appearance="outline"><mat-label>IP Address</mat-label><input matInput [(ngModel)]="form.ipAddress"></mat-form-field><mat-form-field appearance="outline"><mat-label>Port</mat-label><input matInput type="number" [(ngModel)]="form.port"></mat-form-field></div><div class="actions"><button mat-button (click)="cancelForm()">Cancel</button><button mat-raised-button color="primary" (click)="saveDevice()" [disabled]="!form.name">Save Device</button></div></mat-card>
  <div class="device-grid"><mat-card *ngFor="let device of devices" class="device-card"><div class="device-heading"><mat-icon>devices</mat-icon><div><strong>{{device.name}}</strong><small>{{device.brand || 'Brand pending'}} {{device.model || ''}}</small></div><span class="status" [class.ready]="device.status === 'Online'">{{device.status}}</span></div><div class="device-meta"><span>Serial: {{device.serialNumber || 'Not set'}}</span><span>{{device.ipAddress || 'No IP'}}:{{device.port}}</span></div><small *ngIf="device.lastError" class="error">{{device.lastError}}</small><div class="actions"><button mat-stroked-button (click)="testConnection(device)"><mat-icon>sync</mat-icon> Test Connection</button><button mat-icon-button (click)="editDevice(device)" matTooltip="Edit device"><mat-icon>edit</mat-icon></button></div></mat-card><mat-card *ngIf="!devices.length" class="empty"><mat-icon>devices_other</mat-icon><p>No biometric devices registered yet.</p></mat-card></div>
  <mat-card class="simulation-card"><div class="section-heading"><div><h2>Simulate Biometric Punch</h2><p>Use this until the physical device is available.</p></div><button mat-stroked-button (click)="loadEvents()" [disabled]="eventsLoading"><mat-icon>{{eventsLoading ? 'sync' : 'refresh'}}</mat-icon> {{eventsLoading ? 'Refreshing...' : 'Refresh Events'}}</button></div><div class="form-grid"><mat-form-field appearance="outline"><mat-label>Person Type</mat-label><mat-select [(ngModel)]="simulation.personType"><mat-option value="Student">Student</mat-option><mat-option value="Teacher">Teacher</mat-option></mat-select></mat-form-field><mat-form-field appearance="outline"><mat-label>Biometric User ID</mat-label><input matInput [(ngModel)]="simulation.biometricUserId" placeholder="Mapped device ID"></mat-form-field><mat-form-field appearance="outline"><mat-label>Device Event ID</mat-label><input matInput [(ngModel)]="simulation.eventId" placeholder="Optional unique event ID"></mat-form-field><mat-form-field appearance="outline"><mat-label>Device</mat-label><mat-select [(ngModel)]="simulation.deviceId"><mat-option [value]="''">No device / simulation</mat-option><mat-option *ngFor="let device of devices" [value]="device.id">{{device.name}}</mat-option></mat-select></mat-form-field></div><div class="actions"><button mat-raised-button color="accent" (click)="simulatePunch()" [disabled]="!simulation.biometricUserId || simulating"><mat-icon>fingerprint</mat-icon> Capture Simulated Punch</button><span class="message" *ngIf="message">{{message}}</span></div></mat-card>
  <mat-card class="events-card"><h2>Recent Biometric Events <small>(IST)</small></h2><div class="event-row" *ngFor="let event of events"><span class="event-icon"><mat-icon>fingerprint</mat-icon></span><div><strong>{{event.personType}} / {{event.biometricUserId}}</strong><small>{{event.eventTime | localDatetime:'datetime'}} · {{event.deviceEventId || 'No event ID'}}</small><small class="event-error" *ngIf="event.errorMessage">{{event.errorMessage}}</small></div><span class="event-status" [class.processed]="event.status === 'Processed'" [class.failed]="event.status === 'Failed'">{{event.status}}</span><button mat-icon-button *ngIf="event.status === 'Failed'" (click)="retryEvent(event)" matTooltip="Retry failed event"><mat-icon>replay</mat-icon></button></div><p class="empty-text" *ngIf="!events.length">No biometric events received yet.</p></mat-card>
</div>`,
  styles: [`:host{display:block}.page-container{display:flex;flex-direction:column;gap:18px}.page-header,.section-heading,.device-heading,.actions{display:flex;align-items:center}.page-header,.section-heading{justify-content:space-between}.page-header h1{margin:0;color:#155eaa;display:flex;align-items:center;gap:8px}.page-header p,.section-heading p{margin:5px 0;color:#64748b}.notice{display:flex;align-items:center;gap:10px;color:#475569;background:#eff6ff;border-left:4px solid #2563eb;padding:14px}.form-card,.mapping-card,.simulation-card,.events-card{padding:20px}.form-card h2,.mapping-card h2,.simulation-card h2,.events-card h2{margin:0 0 14px}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.form-grid mat-form-field{width:100%}.mapping-card > .form-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 16px;align-items:start}.mapping-card > .form-grid .actions{grid-column:1 / -1;justify-content:flex-end;padding-top:2px}.col-span-2{grid-column:1 / -1}.actions{justify-content:flex-end;gap:10px;margin-top:8px}.device-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.device-card{padding:18px}.device-heading{gap:10px}.device-heading div{display:flex;flex-direction:column;flex:1}.device-heading small,.device-meta,.event-row small{color:#64748b;font-size:.78rem}.status,.event-status{padding:4px 8px;border-radius:12px;background:#fff7ed;color:#c2410c;font-size:.75rem}.status.ready,.event-status.processed{background:#dcfce7;color:#15803d}.event-status.failed{background:#fee2e2;color:#b91c1c}.device-meta{display:flex;justify-content:space-between;margin:18px 0 8px}.error,.event-error{display:block;color:#b91c1c;margin-bottom:10px}.empty{text-align:center;padding:30px;color:#64748b}.event-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #e2e8f0}.event-row div{display:flex;flex-direction:column;flex:1}.event-icon{color:#2563eb}.empty-text{color:#64748b}@media(max-width:800px){.form-grid,.mapping-card > .form-grid,.device-grid{grid-template-columns:1fr}.page-header{align-items:flex-start;gap:12px;flex-direction:column}}`]
})
export class BiometricDevicesComponent implements OnInit {
  private api = API_BASE;
  devices: Device[] = [];
  events: EventLog[] = [];
  people: MappingPerson[] = [];
  loading = false;
  eventsLoading = false;
  simulating = false;
  showForm = false;
  editingId = '';
  message = '';
  form = { name: '', brand: '', model: '', serialNumber: '', ipAddress: '', port: 80, connectionMode: 'PendingAdapter', isActive: true };
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
    this.loadDevices();
    this.loadEvents();
    this.loadMappings();
  }

  loadDevices(): void {
    this.loading = true;
    this.http.get<Device[]>(`${this.api}/biometric-devices`).subscribe({
      next: data => { this.devices = data || []; this.loading = false; },
      error: () => this.loading = false
    });
  }

  loadEvents(): void {
    this.eventsLoading = true;
    this.http.get<EventLog[]>(`${this.api}/biometric-devices/events`).subscribe({
      next: data => { this.events = data || []; this.eventsLoading = false; },
      error: err => {
        this.eventsLoading = false;
        const message = err?.error?.message || 'Could not refresh biometric events.';
        this.message = message;
        this.confirmDialog.alert('Refresh Events Failed', message, 'danger');
      }
    });
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
      if (person.personType !== this.mapping.personType) return false;
      if (this.mapping.personType === 'Teacher') return true;

      if (this.mapping.stream === 'School') {
        const isSchool = person.stream === 'School' || person.stream === 'Both' || !!person.className;
        if (!isSchool) return false;
        if (this.mapping.className && person.className !== this.mapping.className) return false;
        if (this.mapping.sectionName && person.sectionName !== this.mapping.sectionName) return false;
      } else if (this.mapping.stream === 'Coaching') {
        const isCoaching = person.stream === 'Coaching' || person.stream === 'Both' || !!person.batchName;
        if (!isCoaching) return false;
        if (this.mapping.batchName && person.batchName !== this.mapping.batchName) return false;
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

  onPersonSelected(): void {
    const person = this.people.find(p => p.id === this.mapping.personId);
    if (person) {
      this.mapping.biometricUserId = person.biometricUserId || '';
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
    this.http.put(`${this.api}/attendance/mappings/${person.personType.toLowerCase()}/${person.id}`, { biometricUserId: newId }).subscribe({
      next: () => {
        person.biometricUserId = newId;
        this.confirmDialog.alert('Mapping Saved', `${person.personType} "${person.name}" biometric mapping updated (${newId}).`, 'success');
      },
      error: err => this.confirmDialog.alert('Mapping Failed', err?.error?.message || 'Could not save biometric mapping.', 'danger')
    });
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
    this.message = '';
    this.http.post<any>(`${this.api}/attendance/biometric-events`, {
      personType: this.simulation.personType,
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
