import { Component, OnInit, OnDestroy, Inject, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDividerModule } from '@angular/material/divider';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { 
  InfirmaryService, 
  InfirmaryVisit, 
  InfirmaryStats, 
  CreateInfirmaryVisit, 
  DispensedMedicine,
  DischargeInfirmaryVisit 
} from '../../core/services/infirmary.service';
import { AuthService } from '../../core/services/auth.service';
import { CoachingService } from '../../core/services/coaching.service';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItem } from '../inventory/inventory.models';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';

@Component({
  selector: 'app-infirmary',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatDividerModule
  ],
  template: `
    <div class="page-container">
      <!-- Top Action Ribbon -->
      <div class="header-ribbon">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>local_hospital</mat-icon>
          </div>
          <div>
            <h1 class="page-title">Infirmary & First-Aid Sick Bay</h1>
            <p class="page-subtitle">
              Campus medical room, sick bed occupancy, health checkups & inventory medicine dispensation
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" class="log-visit-btn" (click)="openLogVisitDialog()">
            <mat-icon>add</mat-icon> Log Clinic Visit
          </button>
        </div>
      </div>

      <!-- Single Global Loader -->
      <mat-progress-bar *ngIf="loading" mode="indeterminate" class="module-loader"></mat-progress-bar>

      <!-- KPI Metrics Ribbon (Responsive 4 -> 2 -> 1) -->
      <div class="kpi-grid">
        <mat-card class="kpi-card card-blue">
          <div class="kpi-content">
            <div class="kpi-text">
              <span class="kpi-label">Today's Clinic Visits</span>
              <span class="kpi-val">{{ stats?.todayVisitsCount || 0 }}</span>
            </div>
            <div class="kpi-icon-wrap bg-blue">
              <mat-icon>personal_injury</mat-icon>
            </div>
          </div>
          <div class="kpi-footer">Active OPD checkups today</div>
        </mat-card>

        <mat-card class="kpi-card card-amber">
          <div class="kpi-content">
            <div class="kpi-text">
              <span class="kpi-label">Sick Beds Occupied</span>
              <span class="kpi-val">{{ stats?.currentlyOccupiedBeds || 0 }}</span>
            </div>
            <div class="kpi-icon-wrap bg-amber">
              <mat-icon>hotel</mat-icon>
            </div>
          </div>
          <div class="kpi-footer">Currently resting in sick bay</div>
        </mat-card>

        <mat-card class="kpi-card card-rose">
          <div class="kpi-content">
            <div class="kpi-text">
              <span class="kpi-label">Severe / Referred (Month)</span>
              <span class="kpi-val">{{ stats?.severeReferredMonthCount || 0 }}</span>
            </div>
            <div class="kpi-icon-wrap bg-rose">
              <mat-icon>emergency</mat-icon>
            </div>
          </div>
          <div class="kpi-footer">Hospital referred or critical cases</div>
        </mat-card>

        <mat-card class="kpi-card card-emerald">
          <div class="kpi-content">
            <div class="kpi-text">
              <span class="kpi-label">Medicines Dispensed (Month)</span>
              <span class="kpi-val">{{ stats?.totalMedicinesDispensedUnits || 0 | number:'1.0-0' }} <small>units</small></span>
            </div>
            <div class="kpi-icon-wrap bg-emerald">
              <mat-icon>medication</mat-icon>
            </div>
          </div>
          <div class="kpi-footer">Deducted from Store Inventory</div>
        </mat-card>
      </div>

      <!-- Reactive Filter Deck (Pure Angular Material Reactive Forms) -->
      <mat-card class="filter-card">
        <form [formGroup]="filterForm" class="filter-deck">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Patient Category</mat-label>
            <mat-select formControlName="patientType">
              <mat-option value="All">All Patients</mat-option>
              <mat-option value="Student">Students Only</mat-option>
              <mat-option value="Staff">Faculty / Staff</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Severity</mat-label>
            <mat-select formControlName="severity">
              <mat-option value="All">All Severities</mat-option>
              <mat-option value="Mild">Mild</mat-option>
              <mat-option value="Moderate">Moderate</mat-option>
              <mat-option value="Severe">Severe</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Current Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="All">All Statuses</mat-option>
              <mat-option value="UnderObservation">Under Observation</mat-option>
              <mat-option value="Recovered">Recovered</mat-option>
              <mat-option value="Discharged">Discharged</mat-option>
              <mat-option value="SentHome">Sent Home</mat-option>
              <mat-option value="Referred">Referred to Hospital</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field search-field">
            <mat-label>Search Patient, Visit #, Symptoms</mat-label>
            <input matInput formControlName="searchTerm" placeholder="Type patient name, complaints..." />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <button mat-stroked-button color="warn" type="button" class="reset-btn" (click)="resetFilters()">
            <mat-icon>restart_alt</mat-icon> Reset
          </button>
        </form>
      </mat-card>

      <!-- Medical Visits Responsive Data Table -->
      <mat-card class="table-card">
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th style="min-width: 130px;">Visit #</th>
                <th style="min-width: 200px;">Patient Details</th>
                <th style="min-width: 140px;">Visit Time (IST)</th>
                <th style="min-width: 190px;">Chief Complaints & Vitals</th>
                <th style="min-width: 140px;">Sick Bed Rest</th>
                <th style="min-width: 180px;">Dispensed Medicines</th>
                <th style="min-width: 130px;">Severity & Alert</th>
                <th style="min-width: 130px;">Status</th>
                <th style="min-width: 140px; text-align: center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of visits">
                <!-- Visit Number -->
                <td>
                  <span class="visit-code">{{ v.visitNumber }}</span>
                  <div class="patient-type-pill" [class.type-student]="v.patientType === 'Student'" [class.type-staff]="v.patientType === 'Staff'">
                    {{ v.patientType }}
                  </div>
                </td>

                <!-- Patient Particulars -->
                <td>
                  <div class="patient-name">{{ v.patientName }}</div>
                  <div class="patient-sub">{{ v.classOrDesignation || '—' }}</div>
                  <div class="patient-phone" *ngIf="v.contactPhone">
                    <mat-icon class="phone-ic">call</mat-icon> {{ v.contactPhone }}
                  </div>
                </td>

                <!-- Visit Time (IST Asia/Kolkata) -->
                <td>
                  <div class="time-primary">{{ v.visitDate | date:'dd MMM yyyy':'Asia/Kolkata' }}</div>
                  <div class="time-sub">{{ v.visitDate | date:'hh:mm a':'Asia/Kolkata' }}</div>
                </td>

                <!-- Symptoms & Vitals -->
                <td>
                  <div class="complaints-text">{{ v.chiefComplaints }}</div>
                  <div class="vitals-row" *ngIf="v.temperatureF || v.pulseBpm || v.bloodPressure">
                    <span class="vital-pill" *ngIf="v.temperatureF" [class.vital-hot]="v.temperatureF >= 99.5">
                      🌡️ {{ v.temperatureF }}°F
                    </span>
                    <span class="vital-pill" *ngIf="v.pulseBpm">
                      ❤️ {{ v.pulseBpm }} bpm
                    </span>
                    <span class="vital-pill" *ngIf="v.bloodPressure">
                      BP: {{ v.bloodPressure }}
                    </span>
                  </div>
                </td>

                <!-- Sick Bay Bed Rest -->
                <td>
                  <div *ngIf="v.bedRestRequired; else noBedRest">
                    <span class="bed-pill" [class.bed-occupied]="v.bedStatus === 'Occupied'" [class.bed-discharged]="v.bedStatus === 'Discharged'">
                      🛏️ {{ v.bedNumber || 'Bed Assigned' }}
                    </span>
                    <div class="bed-meta" *ngIf="v.bedStatus === 'Occupied'">
                      In since {{ v.admittedAt | date:'hh:mm a':'Asia/Kolkata' }}
                    </div>
                    <div class="bed-meta" *ngIf="v.bedStatus === 'Discharged' && v.dischargedAt">
                      Discharged {{ v.dischargedAt | date:'hh:mm a':'Asia/Kolkata' }}
                    </div>
                  </div>
                  <ng-template #noBedRest>
                    <span class="text-muted">OPD Consultation</span>
                  </ng-template>
                </td>

                <!-- Dispensed Medicines from Inventory -->
                <td>
                  <div class="medicines-wrap" *ngIf="v.medicinesDispensed && v.medicinesDispensed.length > 0; else noMeds">
                    <span class="med-tag" *ngFor="let m of v.medicinesDispensed" [matTooltip]="m.dosage || 'Dispensed from Inventory'">
                      💊 {{ m.itemName }} ({{ m.quantity }} {{ m.unit || 'unit' }})
                    </span>
                  </div>
                  <ng-template #noMeds>
                    <span class="text-muted">First-aid / Dressing only</span>
                  </ng-template>
                </td>

                <!-- Severity & Parent Alert -->
                <td>
                  <span class="severity-pill" [ngClass]="{
                    'sev-mild': v.severity === 'Mild',
                    'sev-moderate': v.severity === 'Moderate',
                    'sev-severe': v.severity === 'Severe'
                  }">
                    {{ v.severity }}
                  </span>
                  <div class="parent-notified" *ngIf="v.parentContacted">
                    <mat-icon class="alert-ic">check_circle</mat-icon> Parent Alerted
                  </div>
                  <div class="hospital-ref" *ngIf="v.referredToHospital">
                    <mat-icon class="alert-ic">local_hospital</mat-icon> Hospital Ref
                  </div>
                </td>

                <!-- Status -->
                <td>
                  <span class="status-pill" [ngClass]="{
                    'stat-obs': v.status === 'UnderObservation',
                    'stat-rec': v.status === 'Recovered',
                    'stat-dis': v.status === 'Discharged',
                    'stat-ref': v.status === 'Referred',
                    'stat-home': v.status === 'SentHome'
                  }">
                    {{ v.status }}
                  </span>
                </td>

                <!-- Actions -->
                <td style="text-align: center;">
                  <div class="action-buttons">
                    <button mat-icon-button color="primary" (click)="viewSlip(v)" matTooltip="View / Print Clinic Slip">
                      <mat-icon>receipt_long</mat-icon>
                    </button>
                    <button mat-icon-button color="accent" *ngIf="v.bedRestRequired && v.bedStatus === 'Occupied'" (click)="dischargePatient(v)" matTooltip="Discharge from Sick Bay">
                      <mat-icon>exit_to_app</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteVisit(v)" matTooltip="Delete Record">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="!loading && visits.length === 0">
                <td colspan="9" class="no-records">
                  <div class="empty-state">
                    <mat-icon class="empty-icon">healing</mat-icon>
                    <h3>No Infirmary visits recorded for selected filters</h3>
                    <p>Click "Log Clinic Visit" above to record a new medical visit or first-aid treatment.</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>
    </div>
  `,
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

    /* Top Action Ribbon */
    .header-ribbon {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-box {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #2563eb;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.25);
    }

    .header-icon-box mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .page-title {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      margin: 4px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    .log-visit-btn {
      height: 44px;
      font-weight: 700;
      border-radius: 8px;
    }

    .module-loader {
      border-radius: 4px;
    }

    /* KPI Deck Responsive Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .kpi-card {
      padding: 16px 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      background: #ffffff;
    }

    .kpi-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }

    .kpi-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .kpi-val {
      font-size: 28px;
      font-weight: 800;
      color: #0f172a;
    }

    .kpi-val small {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
    }

    .kpi-icon-wrap {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bg-blue { background: #eff6ff; color: #2563eb; }
    .bg-amber { background: #fffbeb; color: #d97706; }
    .bg-rose { background: #fff1f2; color: #e11d48; }
    .bg-emerald { background: #ecfdf5; color: #059669; }

    .kpi-footer {
      margin-top: 10px;
      font-size: 11px;
      color: #94a3b8;
    }

    /* Filter Card */
    .filter-card {
      padding: 16px 20px 4px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      background: #ffffff;
    }

    .filter-deck {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-field {
      flex: 1;
      min-width: 170px;
    }

    .search-field {
      flex: 2;
      min-width: 250px;
    }

    .reset-btn {
      height: 52px;
      margin-bottom: 22px;
      font-weight: 600;
    }

    /* Table */
    .table-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }

    .custom-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    .custom-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      padding: 14px 16px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      white-space: nowrap;
    }

    .custom-table td {
      padding: 14px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      vertical-align: middle;
      white-space: nowrap;
    }

    .custom-table tr:hover {
      background: #f8fafc;
    }

    .visit-code {
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 0.03em;
    }

    .patient-type-pill {
      display: inline-block;
      margin-top: 3px;
      font-size: 10px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .type-student { background: #eff6ff; color: #2563eb; }
    .type-staff { background: #fdf2f8; color: #db2777; }

    .patient-name {
      font-weight: 700;
      color: #0f172a;
    }

    .patient-sub {
      font-size: 11px;
      color: #64748b;
    }

    .patient-phone {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: #3b82f6;
    }

    .phone-ic {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .time-primary {
      font-weight: 600;
      color: #1e293b;
    }

    .time-sub {
      font-size: 11px;
      color: #64748b;
    }

    .complaints-text {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }

    .vitals-row {
      display: flex;
      gap: 4px;
      margin-top: 3px;
      flex-wrap: wrap;
    }

    .vital-pill {
      font-size: 10.5px;
      padding: 1px 5px;
      border-radius: 4px;
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
    }

    .vital-hot {
      background: #fef2f2;
      color: #dc2626;
      font-weight: 700;
    }

    .bed-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
    }

    .bed-occupied { background: #fef3c7; color: #b45309; }
    .bed-discharged { background: #f1f5f9; color: #64748b; }

    .bed-meta {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    .medicines-wrap {
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-width: 200px;
    }

    .med-tag {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .severity-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .sev-mild { background: #f0fdf4; color: #166534; }
    .sev-moderate { background: #fffbeb; color: #b45309; }
    .sev-severe { background: #fef2f2; color: #b91c1c; }

    .parent-notified, .hospital-ref {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      margin-top: 3px;
    }

    .parent-notified { color: #16a34a; font-weight: 600; }
    .hospital-ref { color: #dc2626; font-weight: 700; }

    .alert-ic {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .status-pill {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stat-obs { background: #fef3c7; color: #92400e; }
    .stat-rec { background: #dcfce7; color: #15803d; }
    .stat-dis { background: #f1f5f9; color: #475569; }
    .stat-ref { background: #fee2e2; color: #b91c1c; }
    .stat-home { background: #e0e7ff; color: #3730a3; }

    .action-buttons {
      display: flex;
      justify-content: center;
      gap: 2px;
    }

    .no-records {
      text-align: center;
      padding: 40px !important;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
    }

    .text-muted {
      color: #94a3b8;
      font-style: italic;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
      .filter-deck {
        flex-direction: column;
        align-items: stretch;
      }
      .reset-btn {
        width: 100%;
        margin-bottom: 0;
      }
    }
  `]
})
export class InfirmaryComponent implements OnInit, OnDestroy {
  visits: InfirmaryVisit[] = [];
  stats: InfirmaryStats | null = null;
  loading = false;

  filterForm!: FormGroup;
  private sub = new Subscription();

  constructor(
    private fb: FormBuilder,
    private infirmaryService: InfirmaryService,
    private authService: AuthService,
    private dialog: MatDialog,
    private confirmDialog: ConfirmDialogService
  ) {
    // Auto sync when active branch changes globally
    effect(() => {
      const bId = this.authService.selectedBranchId();
      this.loadVisits();
      this.loadStats();
    });
  }

  ngOnInit(): void {
    this.initFilters();
    this.loadVisits();
    this.loadStats();
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private initFilters(): void {
    this.filterForm = this.fb.group({
      patientType: ['All'],
      severity: ['All'],
      status: ['All'],
      searchTerm: ['']
    });

    this.sub.add(
      this.filterForm.get('patientType')?.valueChanges.subscribe(() => this.loadVisits())
    );
    this.sub.add(
      this.filterForm.get('severity')?.valueChanges.subscribe(() => this.loadVisits())
    );
    this.sub.add(
      this.filterForm.get('status')?.valueChanges.subscribe(() => this.loadVisits())
    );
    this.sub.add(
      this.filterForm.get('searchTerm')?.valueChanges.pipe(
        debounceTime(350),
        distinctUntilChanged()
      ).subscribe(() => this.loadVisits())
    );
  }

  loadVisits(): void {
    this.loading = true;
    const formVal = this.filterForm?.value || {};
    const branchId = this.authService.selectedBranchId() || undefined;

    this.infirmaryService.getVisits({
      branchId,
      patientType: formVal.patientType,
      severity: formVal.severity,
      status: formVal.status,
      searchTerm: formVal.searchTerm
    }).subscribe({
      next: (data) => {
        this.loading = false;
        this.visits = data || [];
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadStats(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.infirmaryService.getStats(branchId).subscribe({
      next: (res) => {
        this.stats = res;
      }
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      patientType: 'All',
      severity: 'All',
      status: 'All',
      searchTerm: ''
    });
  }

  openLogVisitDialog(): void {
    const dialogRef = this.dialog.open(LogInfirmaryVisitDialogComponent, {
      width: '750px',
      maxWidth: '95vw',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.loadVisits();
        this.loadStats();
        this.confirmDialog.alert('Visit Logged', 'Clinical visit recorded and medicines dispensed successfully!', 'success');
      }
    });
  }

  dischargePatient(visit: InfirmaryVisit): void {
    const dialogRef = this.dialog.open(DischargePatientDialogComponent, {
      width: '500px',
      data: { visit }
    });

    dialogRef.afterClosed().subscribe((discharged) => {
      if (discharged) {
        this.loadVisits();
        this.loadStats();
        this.confirmDialog.alert('Patient Discharged', `${visit.patientName} has been discharged from sick bay.`, 'success');
      }
    });
  }

  viewSlip(visit: InfirmaryVisit): void {
    this.dialog.open(MedicalVisitSlipDialogComponent, {
      width: '600px',
      data: { visit }
    });
  }

  deleteVisit(visit: InfirmaryVisit): void {
    this.confirmDialog.confirm(
      'Delete Visit Record',
      `Are you sure you want to delete medical record for ${visit.patientName} (${visit.visitNumber})?`
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.infirmaryService.deleteVisit(visit.id).subscribe({
          next: () => {
            this.loadVisits();
            this.loadStats();
            this.confirmDialog.alert('Deleted', 'Record removed successfully.', 'success');
          },
          error: (err) => {
            this.confirmDialog.alert('Error', err.error?.message || 'Failed to delete record.', 'danger');
          }
        });
      }
    });
  }
}

// =========================================================================
// LOG INFIRMARY VISIT DIALOG (Strict AGENTS.md light-blue gradient header)
// =========================================================================

@Component({
  selector: 'app-log-infirmary-visit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule,
    MatProgressBarModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="dialog-container">
      <!-- Strict AGENTS.md Light Blue Header -->
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>add_box</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Log Clinical / Infirmary Visit</h2>
            <p class="modal-subtitle">Record patient symptoms, vitals, sick bay bed & store medicine dispensation</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-progress-bar *ngIf="saving" mode="indeterminate"></mat-progress-bar>

      <form [formGroup]="visitForm" (ngSubmit)="onSubmit()" class="modal-body">
        
        <!-- ROW 1: Patient Type & Live Search -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="col-field" style="max-width: 180px;">
            <mat-label>Patient Category</mat-label>
            <mat-select formControlName="patientType" (selectionChange)="onPatientTypeChange()">
              <mat-option value="Student">Student</mat-option>
              <mat-option value="Staff">Faculty / Staff</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-field flex-2">
            <mat-label>Search & Select Student <span class="req">*</span></mat-label>
            <input matInput [matAutocomplete]="autoStudent" [formControl]="studentSearchControl" placeholder="Type student name or roll #..." />
            <mat-icon matSuffix>search</mat-icon>
            <mat-autocomplete #autoStudent="matAutocomplete" (optionSelected)="onStudentSelected($event.option.value)">
              <mat-option *ngFor="let s of candidateStudents" [value]="s">
                <strong>{{ s.studentName }}</strong> (Roll: {{ s.rollNumber || '—' }}) • {{ s.className || s.batchName }}
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
        </div>

        <!-- Selected Patient Preview Pill -->
        <div class="patient-preview" *ngIf="visitForm.get('patientName')?.value">
          <mat-icon class="prev-ic">person</mat-icon>
          <div>
            <strong>{{ visitForm.get('patientName')?.value }}</strong>
            <span class="prev-meta" *ngIf="visitForm.get('classOrDesignation')?.value"> • {{ visitForm.get('classOrDesignation')?.value }}</span>
            <span class="prev-meta" *ngIf="visitForm.get('contactPhone')?.value"> • Phone: {{ visitForm.get('contactPhone')?.value }}</span>
          </div>
        </div>

        <!-- ROW 2: Chief Complaints & Symptoms -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="col-field flex-2">
            <mat-label>Chief Complaints / Symptoms <span class="req">*</span></mat-label>
            <input matInput formControlName="chiefComplaints" placeholder="e.g. High fever with headache, nausea, minor knee scrape" />
            <mat-error *ngIf="visitForm.get('chiefComplaints')?.hasError('required')">Complaints required</mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-field" style="max-width: 170px;">
            <mat-label>Severity <span class="req">*</span></mat-label>
            <mat-select formControlName="severity">
              <mat-option value="Mild">Mild</mat-option>
              <mat-option value="Moderate">Moderate</mat-option>
              <mat-option value="Severe">Severe (Urgent)</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- ROW 3: Vitals signs -->
        <div class="vitals-panel">
          <span class="vitals-title">🩺 Clinical Vital Signs:</span>
          <div class="vitals-inputs">
            <mat-form-field appearance="outline" class="vital-input">
              <mat-label>Body Temp (°F)</mat-label>
              <input matInput type="number" step="0.1" formControlName="temperatureF" placeholder="98.6" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="vital-input">
              <mat-label>Pulse (bpm)</mat-label>
              <input matInput type="number" formControlName="pulseBpm" placeholder="72" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="vital-input">
              <mat-label>Blood Pressure</mat-label>
              <input matInput formControlName="bloodPressure" placeholder="120/80" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="vital-input">
              <mat-label>SpO2 (%)</mat-label>
              <input matInput type="number" formControlName="spO2" placeholder="98" />
            </mat-form-field>
          </div>
        </div>

        <!-- ROW 4: Sick Bay Bed Occupancy -->
        <div class="bed-panel">
          <mat-checkbox formControlName="bedRestRequired" color="primary">
            <strong>🛏️ Sick Bay Bed Rest Required</strong>
          </mat-checkbox>

          <mat-form-field appearance="outline" class="bed-field" *ngIf="visitForm.get('bedRestRequired')?.value">
            <mat-label>Assigned Bed Number</mat-label>
            <mat-select formControlName="bedNumber">
              <mat-option value="Bed 1">Bed 1</mat-option>
              <mat-option value="Bed 2">Bed 2</mat-option>
              <mat-option value="Bed 3">Bed 3</mat-option>
              <mat-option value="Bed 4">Bed 4</mat-option>
              <mat-option value="Isolation Bay">Isolation Bay</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- ROW 5: Inventory Medicine Dispensation Picker -->
        <div class="medicine-dispense-panel">
          <div class="panel-header">
            <div>
              <span class="panel-title">💊 Dispense First-Aid Medicines (Store Inventory)</span>
              <p class="panel-sub">Selected medicines will be automatically deducted from store stock</p>
            </div>
          </div>

          <div class="med-picker-row">
            <mat-form-field appearance="outline" class="med-item-select">
              <mat-label>Choose Medicine / Item</mat-label>
              <mat-select [formControl]="selectedMedItemControl">
                <mat-option *ngFor="let it of availableMedicines" [value]="it.id" [disabled]="it.currentStock <= 0">
                  {{ it.itemName }} — Stock: {{ it.currentStock }} {{ it.unitOfMeasurement }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="med-qty-input">
              <mat-label>Qty</mat-label>
              <input matInput type="number" min="1" [formControl]="medQtyControl" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="med-dosage-input">
              <mat-label>Dosage</mat-label>
              <input matInput [formControl]="medDosageControl" placeholder="e.g. 1 Tab SOS after meal" />
            </mat-form-field>

            <button mat-raised-button color="primary" type="button" class="add-med-btn" (click)="addMedicineItem()" [disabled]="!selectedMedItemControl.value">
              <mat-icon>add</mat-icon> Add
            </button>
          </div>

          <!-- Dispensed list table -->
          <div class="dispensed-list" *ngIf="dispensedMedicines.length > 0">
            <div class="dispensed-item" *ngFor="let d of dispensedMedicines; let i = index">
              <span class="d-name">💊 {{ d.itemName }}</span>
              <span class="d-qty">Qty: <strong>{{ d.quantity }} {{ d.unit }}</strong></span>
              <span class="d-dosage">{{ d.dosage }}</span>
              <button mat-icon-button color="warn" (click)="removeMedicineItem(i)">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <!-- ROW 6: Treatment Given & Parent Alert -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="col-field flex-2">
            <mat-label>Treatment / First-Aid Given</mat-label>
            <input matInput formControlName="treatmentGiven" placeholder="e.g. Cold sponging, wound dressed with betadine, glucose water given" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="col-field flex-1">
            <mat-label>Attending Nurse / Staff</mat-label>
            <input matInput formControlName="attendingStaffName" placeholder="Staff Name" />
          </mat-form-field>
        </div>

        <div class="parent-alert-row">
          <mat-checkbox formControlName="parentContacted" color="primary">
            📞 Parent / Guardian Contacted via Phone / WhatsApp
          </mat-checkbox>
          <mat-checkbox formControlName="sentHome" color="primary">
            🚗 Sent Home with Parent / Guardian
          </mat-checkbox>
          <mat-checkbox formControlName="referredToHospital" color="warn">
            🚑 Emergency Hospital Referral
          </mat-checkbox>
        </div>

        <div class="modal-footer">
          <button mat-button type="button" (click)="dialogRef.close(false)">Cancel</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="saving || visitForm.invalid">
            <mat-icon>save</mat-icon> Log Clinical Visit
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .close-btn:hover { color: #1e293b; }
    .req { color: #dc2626; font-weight: 700; }

    .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; max-height: 78vh; overflow-y: auto; }
    .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
    .col-field { flex: 1; }
    .flex-2 { flex: 2; }
    .flex-1 { flex: 1; }

    .patient-preview { background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; border-radius: 8px; display: flex; align-items: center; gap: 10px; font-size: 13px; color: #1e3a8a; }
    .prev-ic { color: #2563eb; }
    .prev-meta { color: #64748b; }

    .vitals-panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .vitals-title { font-size: 13px; font-weight: 700; color: #1e293b; display: block; margin-bottom: 8px; }
    .vitals-inputs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .vital-input { width: 100%; margin-bottom: -16px; }

    .bed-panel { display: flex; align-items: center; gap: 16px; background: #fffbeb; border: 1px solid #fef3c7; padding: 10px 16px; border-radius: 8px; }
    .bed-field { max-width: 180px; margin-bottom: -16px; }

    .medicine-dispense-panel { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
    .panel-title { font-size: 13px; font-weight: 700; color: #1e3a8a; }
    .panel-sub { margin: 2px 0 10px; font-size: 11px; color: #64748b; }
    .med-picker-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .med-item-select { flex: 2; min-width: 220px; }
    .med-qty-input { width: 80px; }
    .med-dosage-input { flex: 1; min-width: 150px; }
    .add-med-btn { height: 50px; margin-bottom: 22px; font-weight: 700; }

    .dispensed-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .dispensed-item { display: flex; justify-content: space-between; align-items: center; background: #ffffff; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px; }
    .d-name { font-weight: 700; color: #1e293b; flex: 2; }
    .d-qty { color: #065f46; flex: 1; }
    .d-dosage { color: #64748b; flex: 2; font-style: italic; }

    .parent-alert-row { display: flex; gap: 16px; flex-wrap: wrap; background: #f8fafc; padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 13px; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; }
  `]
})
export class LogInfirmaryVisitDialogComponent implements OnInit {
  visitForm!: FormGroup;
  studentSearchControl = new FormBuilder().control('');
  candidateStudents: any[] = [];
  availableMedicines: InventoryItem[] = [];
  dispensedMedicines: DispensedMedicine[] = [];

  selectedMedItemControl = new FormBuilder().control('');
  medQtyControl = new FormBuilder().control(1);
  medDosageControl = new FormBuilder().control('1 Dose SOS');

  saving = false;

  constructor(
    public dialogRef: MatDialogRef<LogInfirmaryVisitDialogComponent>,
    private fb: FormBuilder,
    private infirmaryService: InfirmaryService,
    private coachingService: CoachingService,
    private inventoryService: InventoryService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.setupStudentSearch();
    this.loadMedicines();
  }

  private initForm(): void {
    this.visitForm = this.fb.group({
      branchId: [this.authService.selectedBranchId() || null],
      patientType: ['Student', Validators.required],
      studentId: [null],
      staffId: [null],
      patientName: ['', Validators.required],
      classOrDesignation: [''],
      contactPhone: [''],
      chiefComplaints: ['', Validators.required],
      symptomsList: [''],
      temperatureF: [null],
      pulseBpm: [null],
      bloodPressure: [''],
      spO2: [null],
      severity: ['Mild', Validators.required],
      bedRestRequired: [false],
      bedNumber: ['Bed 1'],
      treatmentGiven: [''],
      attendingStaffName: ['School Nurse / Medical Attendant'],
      parentContacted: [false],
      sentHome: [false],
      referredToHospital: [false]
    });
  }

  private setupStudentSearch(): void {
    this.studentSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((val) => {
      const q = typeof val === 'string' ? val.trim() : '';
      if (q.length < 2) {
        this.candidateStudents = [];
        return;
      }
      this.coachingService.getStudentsPaged(1, 15, q).subscribe({
        next: (res: any) => {
          this.candidateStudents = res?.items || [];
        }
      });
    });
  }

  private loadMedicines(): void {
    const branchId = this.authService.selectedBranchId() || undefined;
    this.inventoryService.getItems({
      branchId,
      activeOnly: true
    }).subscribe({
      next: (items) => {
        this.availableMedicines = items || [];
      }
    });
  }

  onPatientTypeChange(): void {
    const type = this.visitForm.get('patientType')?.value;
    if (type === 'Staff') {
      this.visitForm.patchValue({
        studentId: null,
        patientName: 'Staff Member',
        classOrDesignation: 'Faculty'
      });
    } else {
      this.visitForm.patchValue({
        patientName: '',
        classOrDesignation: ''
      });
    }
  }

  onStudentSelected(student: any): void {
    if (!student) return;
    this.visitForm.patchValue({
      studentId: student.id,
      patientName: student.studentName,
      classOrDesignation: student.className || student.batchName || 'Student',
      contactPhone: student.parentWhatsAppPhone || student.emergencyContactPhone || ''
    });
  }

  addMedicineItem(): void {
    const selectedId = this.selectedMedItemControl.value;
    if (!selectedId) return;
    const item = this.availableMedicines.find(i => i.id === selectedId);
    if (!item) return;

    const qty = Number(this.medQtyControl.value) || 1;
    const dosage = this.medDosageControl.value || '1 Dose SOS';

    const existing = this.dispensedMedicines.find(d => d.itemId === item.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      this.dispensedMedicines.push({
        itemId: item.id,
        itemName: item.itemName,
        itemCode: item.itemCode,
        quantity: qty,
        dosage: dosage,
        unit: item.unitOfMeasurement || 'Unit'
      });
    }

    this.selectedMedItemControl.setValue('');
    this.medQtyControl.setValue(1);
    this.medDosageControl.setValue('1 Dose SOS');
  }

  removeMedicineItem(index: number): void {
    this.dispensedMedicines.splice(index, 1);
  }

  onSubmit(): void {
    if (this.visitForm.invalid) {
      this.visitForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const formVal = this.visitForm.value;

    const payload: CreateInfirmaryVisit = {
      branchId: formVal.branchId,
      patientType: formVal.patientType,
      studentId: formVal.studentId,
      staffId: formVal.staffId,
      patientName: formVal.patientName,
      classOrDesignation: formVal.classOrDesignation,
      contactPhone: formVal.contactPhone,
      chiefComplaints: formVal.chiefComplaints,
      symptomsList: formVal.symptomsList,
      temperatureF: formVal.temperatureF,
      pulseBpm: formVal.pulseBpm,
      bloodPressure: formVal.bloodPressure,
      spO2: formVal.spO2,
      severity: formVal.severity,
      bedRestRequired: !!formVal.bedRestRequired,
      bedNumber: formVal.bedRestRequired ? formVal.bedNumber : null,
      treatmentGiven: formVal.treatmentGiven,
      medicinesDispensed: this.dispensedMedicines,
      attendingStaffName: formVal.attendingStaffName,
      parentContacted: !!formVal.parentContacted,
      sentHome: !!formVal.sentHome,
      referredToHospital: !!formVal.referredToHospital,
      status: formVal.bedRestRequired ? 'UnderObservation' : 'Recovered'
    };

    this.infirmaryService.createVisit(payload).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
      }
    });
  }
}

// =========================================================================
// DISCHARGE PATIENT DIALOG
// =========================================================================

@Component({
  selector: 'app-discharge-patient-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <div class="modal-header">
        <div class="header-left">
          <div class="header-icon-box">
            <mat-icon>exit_to_app</mat-icon>
          </div>
          <div>
            <h2 class="modal-title">Discharge from Sick Bay</h2>
            <p class="modal-subtitle">Patient: <strong>{{ data.visit.patientName }}</strong> (Bed: {{ data.visit.bedNumber }})</p>
          </div>
        </div>
        <button mat-icon-button (click)="dialogRef.close(false)" class="close-btn"><mat-icon>close</mat-icon></button>
      </div>

      <div class="modal-body">
        <p style="font-size: 13px; color: #475569; margin: 0 0 12px;">
          Confirm that the patient has recovered and is ready to return to class / leave sick bay.
        </p>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Discharge Notes / Follow-up Advice</mat-label>
          <textarea matInput [formControl]="notesControl" rows="3" placeholder="e.g. Temperature normalized (98.4°F), headache relieved, student sent back to class"></textarea>
        </mat-form-field>

        <div style="display:flex; justify-content: flex-end; gap: 10px; margin-top: 12px;">
          <button mat-button (click)="dialogRef.close(false)">Cancel</button>
          <button mat-raised-button color="primary" (click)="confirmDischarge()">
            <mat-icon>check_circle</mat-icon> Confirm Discharge
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 18px; }
    .modal-subtitle { color: #3b82f6; margin: 3px 0 0; font-size: 12px; }
    .close-btn { color: #64748b; }
    .modal-body { padding: 20px 24px; }
  `]
})
export class DischargePatientDialogComponent {
  notesControl = new FormBuilder().control('');

  constructor(
    public dialogRef: MatDialogRef<DischargePatientDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { visit: InfirmaryVisit },
    private infirmaryService: InfirmaryService
  ) {}

  confirmDischarge(): void {
    const dto: DischargeInfirmaryVisit = {
      dischargedAt: new Date().toISOString(),
      status: 'Discharged',
      remarks: this.notesControl.value || undefined
    };

    this.infirmaryService.dischargePatient(this.data.visit.id, dto).subscribe({
      next: () => this.dialogRef.close(true)
    });
  }
}

// =========================================================================
// MEDICAL VISIT SLIP DIALOG (Printable)
// =========================================================================

@Component({
  selector: 'app-medical-visit-slip-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatDividerModule],
  template: `
    <div class="dialog-container">
      <div class="modal-header no-print">
        <div class="header-left">
          <div class="header-icon-box"><mat-icon>receipt_long</mat-icon></div>
          <div>
            <h2 class="modal-title">Clinical Medical Slip</h2>
            <p class="modal-subtitle">Ref: <strong>{{ data.visit.visitNumber }}</strong></p>
          </div>
        </div>
        <div>
          <button mat-icon-button (click)="printSlip()"><mat-icon>print</mat-icon></button>
          <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      <div class="slip-content print-area">
        <div class="slip-title-bar">
          <h3>CAMPUS INFIRMARY & HEALTH BAY</h3>
          <p class="slip-meta">CLINICAL VISIT & PRESCRIPTION SLIP</p>
        </div>

        <div class="slip-grid">
          <div><strong>Visit #:</strong> {{ data.visit.visitNumber }}</div>
          <div><strong>Date & Time (IST):</strong> {{ data.visit.visitDate | date:'dd MMM yyyy, hh:mm a':'Asia/Kolkata' }}</div>
          <div><strong>Patient Name:</strong> {{ data.visit.patientName }}</div>
          <div><strong>Category / Class:</strong> {{ data.visit.patientType }} • {{ data.visit.classOrDesignation }}</div>
          <div><strong>Contact:</strong> {{ data.visit.contactPhone || '—' }}</div>
          <div><strong>Severity:</strong> {{ data.visit.severity }}</div>
        </div>

        <mat-divider style="margin: 14px 0;"></mat-divider>

        <div class="slip-section">
          <strong>Chief Complaints:</strong>
          <p>{{ data.visit.chiefComplaints }}</p>
        </div>

        <div class="slip-vitals" *ngIf="data.visit.temperatureF || data.visit.pulseBpm || data.visit.bloodPressure">
          <span *ngIf="data.visit.temperatureF">Temp: <strong>{{ data.visit.temperatureF }}°F</strong></span>
          <span *ngIf="data.visit.pulseBpm">Pulse: <strong>{{ data.visit.pulseBpm }} bpm</strong></span>
          <span *ngIf="data.visit.bloodPressure">BP: <strong>{{ data.visit.bloodPressure }}</strong></span>
          <span *ngIf="data.visit.spO2">SpO2: <strong>{{ data.visit.spO2 }}%</strong></span>
        </div>

        <div class="slip-section" *ngIf="data.visit.treatmentGiven">
          <strong>Treatment Provided:</strong>
          <p>{{ data.visit.treatmentGiven }}</p>
        </div>

        <div class="slip-section" *ngIf="data.visit.medicinesDispensed && data.visit.medicinesDispensed.length > 0">
          <strong>Medicines Dispensed (Store Stock):</strong>
          <ul class="med-list">
            <li *ngFor="let m of data.visit.medicinesDispensed">
              <strong>{{ m.itemName }}</strong> — Qty: {{ m.quantity }} {{ m.unit }} ({{ m.dosage }})
            </li>
          </ul>
        </div>

        <div class="slip-section" *ngIf="data.visit.bedRestRequired">
          <strong>Sick Bay Rest:</strong> {{ data.visit.bedNumber }} • Status: {{ data.visit.bedStatus }}
        </div>

        <div class="slip-footer">
          <div>
            <span>Attending Nurse / Attendant:</span>
            <strong>{{ data.visit.attendingStaffName || 'School Medical Attendant' }}</strong>
          </div>
          <div class="sign-box">
            <span>Authorized Signature</span>
          </div>
        </div>
      </div>

      <div class="modal-footer no-print">
        <button mat-raised-button color="primary" (click)="printSlip()"><mat-icon>print</mat-icon> Print Slip</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container { display: flex; flex-direction: column; background: #fff; border-radius: 12px; overflow: hidden; }
    .modal-header { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-bottom: 1px solid #bfdbfe; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .header-icon-box { background: #2563eb; color: #ffffff; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
    .modal-title { color: #1e3a8a; font-weight: 700; margin: 0; font-size: 16px; }
    .modal-subtitle { color: #3b82f6; margin: 2px 0 0; font-size: 11px; }

    .slip-content { padding: 24px; font-size: 13px; color: #1e293b; }
    .slip-title-bar { text-align: center; margin-bottom: 16px; }
    .slip-title-bar h3 { margin: 0; color: #1e3a8a; font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
    .slip-meta { margin: 2px 0 0; font-size: 11px; color: #64748b; font-weight: 700; letter-spacing: 1px; }

    .slip-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; background: #f8fafc; padding: 12px; border-radius: 6px; }
    .slip-section { margin-bottom: 10px; }
    .slip-section p { margin: 3px 0 0; color: #334155; }
    .slip-vitals { display: flex; gap: 14px; background: #eff6ff; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 12px; color: #1e40af; }
    .med-list { margin: 4px 0 0; padding-left: 18px; }

    .slip-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 32px; padding-top: 14px; border-top: 1px dashed #cbd5e1; }
    .sign-box { border-top: 1px solid #000; width: 140px; text-align: center; padding-top: 4px; font-size: 11px; }
    .modal-footer { padding: 12px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; }

    @media print {
      .no-print { display: none !important; }
      .print-area { padding: 0 !important; }
    }
  `]
})
export class MedicalVisitSlipDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<MedicalVisitSlipDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { visit: InfirmaryVisit }
  ) {}

  printSlip(): void {
    window.print();
  }
}
