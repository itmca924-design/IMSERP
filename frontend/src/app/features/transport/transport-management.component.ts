import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { SchoolService, SchoolClassDto } from '../../core/services/school.service';
import { CoachingService } from '../../core/services/coaching.service';
import {
  TransportService,
  TransportOverviewDto,
  TransportDriverDto,
  CreateTransportDriverDto,
  TransportVehicleDto,
  CreateTransportVehicleDto,
  TransportRouteDto,
  CreateTransportRouteDto,
  TransportRouteStopDto,
  CreateTransportRouteStopDto,
  TransportAllocationDto,
  CreateTransportAllocationDto,
  TransportBusPassDto,
  BusBoardingManifestDto,
  CampusGatePassDto,
  CreateCampusGatePassDto
} from '../../core/services/transport.service';

@Component({
  selector: 'app-transport-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatCheckboxModule,
    MatDialogModule,
    MatTableModule,
    MatMenuModule
  ],
  templateUrl: './transport-management.component.html',
  styleUrls: ['./transport-management.component.scss']
})
export class TransportManagementComponent implements OnInit {
  activeTab = 0;
  activeTopAction: 'student' | 'faculty' | 'gatePass' = 'student';
  loading = false;
  overview: TransportOverviewDto | null = null;

  // Data lists
  vehicles: TransportVehicleDto[] = [];
  drivers: TransportDriverDto[] = [];
  routes: TransportRouteDto[] = [];
  studentAllocations: TransportAllocationDto[] = [];
  teacherAllocations: TransportAllocationDto[] = [];
  gatePasses: CampusGatePassDto[] = [];
  manifest: BusBoardingManifestDto | null = null;
  selectedBusPass: TransportBusPassDto | null = null;

  // Autocomplete / Select Lookups
  studentsList: any[] = [];
  teachersList: any[] = [];
  schoolClasses: SchoolClassDto[] = [];
  batchesList: any[] = [];
  schoolClassFilterOptions: { key: string; name: string; count: number; classId?: string; sectionId?: string; type: 'class' | 'section' }[] = [];
  batchFilterOptions: { key: string; name: string; count: number; batchId: string }[] = [];
  selectedAllocationClassFilter = 'ALL';
  selectedGatePassClassFilter = 'ALL';

  // Filter & Search
  allocationSearch = '';
  gatePassTypeFilter = '';
  gatePassStatusFilter = '';
  manifestRouteId = '';
  manifestDeparture = 'Morning';

  // Modals visibility
  showVehicleModal = false;
  showDriverModal = false;
  showRouteModal = false;
  showStopModal = false;
  showAllocationModal = false;
  showGatePassModal = false;
  showBusPassModal = false;
  showClosePassModal = false;

  // Editing state
  editingVehicleId: string | null = null;
  editingDriverId: string | null = null;
  editingRouteId: string | null = null;
  editingStopId: string | null = null;
  editingAllocationId: string | null = null;
  selectedRouteForStops: TransportRouteDto | null = null;
  selectedGatePassForClose: CampusGatePassDto | null = null;

  // Reactive Forms
  vehicleForm!: FormGroup;
  driverForm!: FormGroup;
  routeForm!: FormGroup;
  stopForm!: FormGroup;
  allocationForm!: FormGroup;
  gatePassForm!: FormGroup;
  closePassForm!: FormGroup;

  // QR Pass Scanner & Boarding State
  showQrScanModal = false;
  qrScanInput = '';
  qrScanSuccessMsg = '';
  qrScanError = '';
  isSavingBoarding = false;
  isNotifyingParents = false;

  constructor(
    private transportService: TransportService,
    private fb: FormBuilder,
    private http: HttpClient,
    private confirmDialog: ConfirmDialogService,
    private schoolService: SchoolService,
    private coachingService: CoachingService
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadOverview();
    this.loadVehicles();
    this.loadDrivers();
    this.loadRoutes();
    this.loadAllocations();
    this.loadGatePasses();
    this.loadLookups();
  }

  getNowLocalDateTimeString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  getTodayDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  clampYear(controlName: string, form: FormGroup): void {
    const ctrl = form.get(controlName);
    if (!ctrl || !ctrl.value) return;
    const val = String(ctrl.value).trim();
    const parts = val.split('-');
    if (parts.length > 0 && parts[0].length > 4) {
      parts[0] = parts[0].substring(0, 4);
      ctrl.setValue(parts.join('-'), { emitEvent: false });
    }
  }

  initForms(): void {
    this.vehicleForm = this.fb.group({
      vehicleNumber: ['', [Validators.required]],
      vehicleType: ['Bus', [Validators.required]],
      totalCapacity: [40, [Validators.required, Validators.min(1)]],
      model: [''],
      color: ['Yellow'],
      driverId: [null],
      conductorName: [''],
      conductorPhone: [''],
      gpsDeviceId: [''],
      insuranceExpiry: [''],
      fitnessExpiry: [''],
      pollutionExpiry: ['']
    });

    this.driverForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phoneNumber: ['', [Validators.required]],
      emergencyPhone: [''],
      licenseNumber: ['', [Validators.required]],
      licenseExpiry: [''],
      aadhaarNumber: [''],
      address: ['']
    });

    this.routeForm = this.fb.group({
      routeCode: ['', [Validators.required]],
      routeName: ['', [Validators.required]],
      startPoint: [''],
      endPoint: ['Campus'],
      vehicleId: [null],
      morningDepartureTime: ['07:00 AM'],
      eveningDepartureTime: ['03:30 PM'],
      description: ['']
    });

    this.stopForm = this.fb.group({
      stopName: ['', [Validators.required]],
      stopOrder: [1, [Validators.required, Validators.min(1)]],
      pickupTime: ['07:15 AM'],
      dropTime: ['03:45 PM'],
      monthlyFare: [1200, [Validators.required, Validators.min(0)]],
      quarterlyFare: [3400],
      annualFare: [13000],
      landmark: [''],
      distanceKm: [0]
    });

    this.allocationForm = this.fb.group({
      memberType: ['Student', [Validators.required]],
      studentId: [null],
      teacherId: [null],
      routeId: [null, [Validators.required]],
      routeStopId: [null, [Validators.required]],
      vehicleId: [null],
      pickupDropType: ['Both', [Validators.required]],
      monthlyFare: [0, [Validators.required]],
      isFreeAllocation: [false],
      effectiveFrom: [this.getTodayDateString(), [Validators.required]],
      remarks: ['']
    });

    this.gatePassForm = this.fb.group({
      passType: ['StudentEarlyExit', [Validators.required]],
      studentId: [null],
      teacherId: [null],
      vehicleId: [null],
      personName: [''],
      contactNumber: [''],
      purpose: ['', [Validators.required]],
      outDateTime: [this.getNowLocalDateTimeString(), [Validators.required]],
      expectedInDateTime: [''],
      approvedBy: ['Admin'],
      securityGuardName: ['Main Gate Guard'],
      passengerCount: [1],
      remarks: ['']
    });

    this.closePassForm = this.fb.group({
      actualInDateTime: [this.getNowLocalDateTimeString()],
      remarks: ['Returned safely']
    });
  }

  // --- Data Loading ---

  loadOverview(): void {
    this.transportService.getOverview().subscribe({
      next: (res) => this.overview = res,
      error: (err) => console.error('Failed to load transport overview', err)
    });
  }

  loadVehicles(): void {
    this.transportService.getVehicles(true).subscribe({
      next: (res) => this.vehicles = res,
      error: (err) => console.error('Failed to load vehicles', err)
    });
  }

  loadDrivers(): void {
    this.transportService.getDrivers(true).subscribe({
      next: (res) => this.drivers = res,
      error: (err) => console.error('Failed to load drivers', err)
    });
  }

  loadRoutes(): void {
    this.transportService.getRoutes(true, true).subscribe({
      next: (res) => {
        this.routes = res;
        if (res.length > 0 && !this.manifestRouteId) {
          this.manifestRouteId = res[0].id;
          this.loadManifest();
        }
      },
      error: (err) => console.error('Failed to load routes', err)
    });
  }

  loadAllocations(): void {
    this.loading = true;
    this.transportService.getAllocations(undefined, undefined, 'Active', this.allocationSearch).subscribe({
      next: (res) => {
        this.studentAllocations = res.filter(a => a.memberType === 'Student');
        this.teacherAllocations = res.filter(a => a.memberType === 'Teacher');
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load allocations', err);
        this.loading = false;
      }
    });
  }

  loadGatePasses(): void {
    this.transportService.getGatePasses(this.gatePassTypeFilter || undefined, this.gatePassStatusFilter || undefined).subscribe({
      next: (res) => this.gatePasses = res,
      error: (err) => console.error('Failed to load gate passes', err)
    });
  }

  loadLookups(): void {
    this.schoolService.getClasses(false).subscribe({
      next: (res) => {
        this.schoolClasses = (res || []).sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        this.rebuildClassFiltersAndGroups();
      },
      error: (err) => console.error('Failed to load school classes', err)
    });

    this.coachingService.getBatches().subscribe({
      next: (res) => {
        this.batchesList = res || [];
        this.rebuildClassFiltersAndGroups();
      },
      error: (err) => console.error('Failed to load coaching batches', err)
    });

    this.coachingService.getStudents().subscribe({
      next: (res) => {
        this.studentsList = res || [];
        this.rebuildClassFiltersAndGroups();
      },
      error: (err) => console.error('Failed to load students', err)
    });

    this.transportService.getTeachers(true).subscribe({
      next: (res) => this.teachersList = res || [],
      error: (err) => console.error('Failed to load teachers', err)
    });
  }

  // --- Vehicles ---

  openAddVehicle(): void {
    this.editingVehicleId = null;
    this.vehicleForm.reset({
      vehicleNumber: '',
      vehicleType: 'Bus',
      totalCapacity: 40,
      color: 'Yellow',
      driverId: null
    });
    this.showVehicleModal = true;
  }

  openEditVehicle(v: TransportVehicleDto): void {
    this.editingVehicleId = v.id;
    this.vehicleForm.patchValue({
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType,
      totalCapacity: v.totalCapacity,
      model: v.model,
      color: v.color,
      driverId: v.driverId,
      conductorName: v.conductorName,
      conductorPhone: v.conductorPhone,
      gpsDeviceId: v.gpsDeviceId,
      insuranceExpiry: v.insuranceExpiry ? v.insuranceExpiry.substring(0, 10) : '',
      fitnessExpiry: v.fitnessExpiry ? v.fitnessExpiry.substring(0, 10) : '',
      pollutionExpiry: v.pollutionExpiry ? v.pollutionExpiry.substring(0, 10) : ''
    });
    this.showVehicleModal = true;
  }

  saveVehicle(): void {
    if (this.vehicleForm.invalid) return;
    const val: CreateTransportVehicleDto = this.vehicleForm.value;
    if (this.editingVehicleId) {
      this.confirmDialog.confirm(
        'Confirm Vehicle Update',
        `Are you sure you want to save changes to vehicle "${val.vehicleNumber}"?`,
        'Update Vehicle',
        'Cancel',
        'info'
      ).subscribe(confirmed => {
        if (!confirmed) return;
        this.transportService.updateVehicle(this.editingVehicleId!, val).subscribe({
          next: () => {
            this.showVehicleModal = false;
            this.loadVehicles();
            this.loadOverview();
            this.confirmDialog.alert('Vehicle Updated', `Vehicle "${val.vehicleNumber}" details updated successfully.`, 'success');
          },
          error: (err) => this.confirmDialog.alert('Update Failed', err.error?.message || 'Failed to update vehicle.', 'danger')
        });
      });
    } else {
      this.transportService.createVehicle(val).subscribe({
        next: () => {
          this.showVehicleModal = false;
          this.loadVehicles();
          this.loadOverview();
          this.confirmDialog.alert('Vehicle Added', `Vehicle "${val.vehicleNumber}" added to fleet successfully.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Creation Failed', err.error?.message || 'Failed to add vehicle.', 'danger')
      });
    }
  }

  toggleVehicle(v: TransportVehicleDto): void {
    const action = v.isActive ? 'deactivate' : 'activate';
    this.confirmDialog.confirm(
      'Toggle Vehicle Status',
      `Are you sure you want to ${action} vehicle "${v.vehicleNumber}"?`,
      v.isActive ? 'Deactivate' : 'Activate',
      'Cancel',
      v.isActive ? 'warning' : 'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.toggleVehicleActive(v.id).subscribe({
        next: () => this.loadVehicles(),
        error: (err) => this.confirmDialog.alert('Operation Failed', err.error?.message || 'Cannot toggle vehicle status.', 'danger')
      });
    });
  }

  // --- Drivers ---

  openAddDriver(): void {
    this.editingDriverId = null;
    this.driverForm.reset();
    this.showDriverModal = true;
  }

  openEditDriver(d: TransportDriverDto): void {
    this.editingDriverId = d.id;
    this.driverForm.patchValue({
      fullName: d.fullName,
      phoneNumber: d.phoneNumber,
      emergencyPhone: d.emergencyPhone,
      licenseNumber: d.licenseNumber,
      licenseExpiry: d.licenseExpiry ? d.licenseExpiry.substring(0, 10) : '',
      aadhaarNumber: d.aadhaarNumber,
      address: d.address
    });
    this.showDriverModal = true;
  }

  saveDriver(): void {
    if (this.driverForm.invalid) return;
    const val: CreateTransportDriverDto = this.driverForm.value;
    if (this.editingDriverId) {
      this.confirmDialog.confirm(
        'Confirm Driver Update',
        `Are you sure you want to save changes for driver "${val.fullName}"?`,
        'Update Driver',
        'Cancel',
        'info'
      ).subscribe(confirmed => {
        if (!confirmed) return;
        this.transportService.updateDriver(this.editingDriverId!, val).subscribe({
          next: () => {
            this.showDriverModal = false;
            this.loadDrivers();
            this.confirmDialog.alert('Driver Updated', `Driver "${val.fullName}" details updated successfully.`, 'success');
          },
          error: (err) => this.confirmDialog.alert('Update Failed', err.error?.message || 'Failed to update driver.', 'danger')
        });
      });
    } else {
      this.transportService.createDriver(val).subscribe({
        next: () => {
          this.showDriverModal = false;
          this.loadDrivers();
          this.confirmDialog.alert('Driver Registered', `Driver "${val.fullName}" registered successfully.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Creation Failed', err.error?.message || 'Failed to register driver.', 'danger')
      });
    }
  }

  toggleDriver(d: TransportDriverDto): void {
    const action = d.isActive ? 'deactivate' : 'activate';
    this.confirmDialog.confirm(
      'Toggle Driver Status',
      `Are you sure you want to ${action} driver "${d.fullName}"?`,
      d.isActive ? 'Deactivate' : 'Activate',
      'Cancel',
      d.isActive ? 'warning' : 'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.toggleDriverActive(d.id).subscribe({
        next: () => this.loadDrivers(),
        error: (err) => this.confirmDialog.alert('Operation Failed', err.error?.message || 'Cannot toggle driver status.', 'danger')
      });
    });
  }

  // --- Routes & Stops ---

  openAddRoute(): void {
    this.editingRouteId = null;
    this.routeForm.reset({
      routeCode: '',
      routeName: '',
      startPoint: '',
      endPoint: 'Campus',
      morningDepartureTime: '07:00 AM',
      eveningDepartureTime: '03:30 PM'
    });
    this.showRouteModal = true;
  }

  openEditRoute(r: TransportRouteDto): void {
    this.editingRouteId = r.id;
    this.routeForm.patchValue({
      routeCode: r.routeCode,
      routeName: r.routeName,
      startPoint: r.startPoint,
      endPoint: r.endPoint,
      vehicleId: r.vehicleId,
      morningDepartureTime: r.morningDepartureTime,
      eveningDepartureTime: r.eveningDepartureTime,
      description: r.description
    });
    this.showRouteModal = true;
  }

  saveRoute(): void {
    if (this.routeForm.invalid) return;
    const val: CreateTransportRouteDto = this.routeForm.value;
    if (this.editingRouteId) {
      this.confirmDialog.confirm(
        'Confirm Route Update',
        `Are you sure you want to save changes to Route "${val.routeCode} - ${val.routeName}"?`,
        'Update Route',
        'Cancel',
        'info'
      ).subscribe(confirmed => {
        if (!confirmed) return;
        this.transportService.updateRoute(this.editingRouteId!, val).subscribe({
          next: () => {
            this.showRouteModal = false;
            this.loadRoutes();
            this.confirmDialog.alert('Route Updated', `Route "${val.routeCode}" updated successfully.`, 'success');
          },
          error: (err) => this.confirmDialog.alert('Update Failed', err.error?.message || 'Failed to update route.', 'danger')
        });
      });
    } else {
      this.transportService.createRoute(val).subscribe({
        next: () => {
          this.showRouteModal = false;
          this.loadRoutes();
          this.loadOverview();
          this.confirmDialog.alert('Route Created', `Route "${val.routeCode} - ${val.routeName}" created successfully.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Creation Failed', err.error?.message || 'Failed to create route.', 'danger')
      });
    }
  }

  toggleRoute(r: TransportRouteDto): void {
    const action = r.isActive ? 'deactivate' : 'activate';
    this.confirmDialog.confirm(
      'Toggle Route Status',
      `Are you sure you want to ${action} route "${r.routeCode}"?`,
      r.isActive ? 'Deactivate' : 'Activate',
      'Cancel',
      r.isActive ? 'warning' : 'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.toggleRouteActive(r.id).subscribe({
        next: () => this.loadRoutes(),
        error: (err) => this.confirmDialog.alert('Operation Failed', err.error?.message || 'Cannot toggle route status.', 'danger')
      });
    });
  }

  manageStops(r: TransportRouteDto): void {
    this.selectedRouteForStops = r;
    this.openAddStop();
  }

  openAddStop(): void {
    this.editingStopId = null;
    const nextOrder = (this.selectedRouteForStops?.stops?.length || 0) + 1;
    this.stopForm.reset({
      stopName: '',
      stopOrder: nextOrder,
      pickupTime: '07:15 AM',
      dropTime: '03:45 PM',
      monthlyFare: 1200,
      quarterlyFare: 3400,
      annualFare: 13000,
      landmark: '',
      distanceKm: 0
    });
    this.showStopModal = true;
  }

  saveStop(): void {
    if (!this.selectedRouteForStops || this.stopForm.invalid) return;
    const val: CreateTransportRouteStopDto = this.stopForm.value;
    if (this.editingStopId) {
      this.confirmDialog.confirm(
        'Confirm Stop Update',
        `Are you sure you want to save changes to stop "${val.stopName}"?`,
        'Update Stop',
        'Cancel',
        'info'
      ).subscribe(confirmed => {
        if (!confirmed) return;
        this.transportService.updateStop(this.editingStopId!, val).subscribe({
          next: () => {
            this.showStopModal = false;
            this.loadRoutes();
            this.confirmDialog.alert('Stop Updated', `Stop "${val.stopName}" updated successfully.`, 'success');
          },
          error: (err) => this.confirmDialog.alert('Update Failed', err.error?.message || 'Failed to update stop.', 'danger')
        });
      });
    } else {
      this.transportService.createStop(this.selectedRouteForStops.id, val).subscribe({
        next: () => {
          this.showStopModal = false;
          this.loadRoutes();
          this.confirmDialog.alert('Stop Added', `Stop "${val.stopName}" added to route.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Creation Failed', err.error?.message || 'Failed to add stop.', 'danger')
      });
    }
  }

  deleteStop(s: TransportRouteStopDto): void {
    this.confirmDialog.danger(
      'Remove Route Stop',
      `Are you sure you want to remove stop "${s.stopName}"? Commuters allocated to this stop may need re-assignment.`,
      'Remove Stop'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.deleteStop(s.id).subscribe({
        next: () => {
          this.loadRoutes();
          this.confirmDialog.alert('Stop Removed', `Stop "${s.stopName}" has been removed.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Cannot Remove Stop', err.error?.message || 'Cannot delete stop.', 'danger')
      });
    });
  }

  selectTab(tabIndex: number): void {
    this.activeTab = tabIndex;
    if (tabIndex === 4) {
      this.activeTopAction = 'student';
    } else if (tabIndex === 5) {
      this.activeTopAction = 'faculty';
    } else if (tabIndex === 7) {
      this.activeTopAction = 'gatePass';
    }
  }

  onTopActionClick(action: 'student' | 'faculty' | 'gatePass'): void {
    this.activeTopAction = action;
    if (action === 'student') {
      this.activeTab = 4;
      this.openAddAllocation('Student');
    } else if (action === 'faculty') {
      this.activeTab = 5;
      this.openAddAllocation('Teacher');
    } else if (action === 'gatePass') {
      this.activeTab = 7;
      this.openAddGatePass();
    }
  }

  // --- Allocations (Passes) ---

  openAddAllocation(memberType: 'Student' | 'Teacher' = 'Student'): void {
    this.editingAllocationId = null;
    this.activeTopAction = memberType === 'Student' ? 'student' : 'faculty';
    this.selectedAllocationClassFilter = 'ALL';
    this.selectedAllocationStudentInfo = '';
    this.rebuildAllocationGroups();
    this.allocationForm.reset({
      memberType,
      pickupDropType: 'Both',
      isFreeAllocation: false,
      monthlyFare: 0,
      effectiveFrom: this.getTodayDateString(),
      remarks: ''
    });
    this.showAllocationModal = true;
  }

  openEditAllocation(a: TransportAllocationDto): void {
    this.editingAllocationId = a.id;
    this.activeTopAction = a.memberType === 'Student' ? 'student' : 'faculty';
    this.selectedAllocationClassFilter = 'ALL';
    this.selectedAllocationStudentInfo = a.studentName
      ? `${a.studentName} (Roll: ${a.studentRollNumber || a.rollNumber || 'N/A'})`
      : (a.teacherName || '');
    this.rebuildAllocationGroups();

    const formattedDate = a.effectiveFrom
      ? new Date(a.effectiveFrom).toISOString().substring(0, 10)
      : this.getTodayDateString();

    this.allocationForm.reset({
      memberType: a.memberType,
      studentId: a.studentId,
      teacherId: a.teacherId,
      routeId: a.routeId,
      routeStopId: a.routeStopId,
      vehicleId: a.vehicleId,
      pickupDropType: a.pickupDropType || 'Both',
      monthlyFare: a.monthlyFare,
      isFreeAllocation: a.isFreeAllocation,
      effectiveFrom: formattedDate,
      remarks: a.remarks || ''
    });

    this.showAllocationModal = true;
  }

  onIsFreeAllocationToggle(isFree: boolean): void {
    if (isFree) {
      this.allocationForm.patchValue({ monthlyFare: 0 });
    } else {
      const routeId = this.allocationForm.get('routeId')?.value;
      const stopId = this.allocationForm.get('routeStopId')?.value;
      const selectedRoute = this.routes.find(r => r.id === routeId);
      const stop = selectedRoute?.stops?.find(s => s.id === stopId);
      if (stop) {
        this.allocationForm.patchValue({ monthlyFare: stop.monthlyFare });
      }
    }
  }

  onRouteChangeForAllocation(routeId: string): void {
    const selectedRoute = this.routes.find(r => r.id === routeId);
    if (selectedRoute?.vehicleId) {
      this.allocationForm.patchValue({ vehicleId: selectedRoute.vehicleId });
    }
  }

  onStopChangeForAllocation(stopId: string): void {
    const routeId = this.allocationForm.get('routeId')?.value;
    const selectedRoute = this.routes.find(r => r.id === routeId);
    const stop = selectedRoute?.stops?.find(s => s.id === stopId);
    if (stop) {
      const isFree = this.allocationForm.get('isFreeAllocation')?.value;
      this.allocationForm.patchValue({ monthlyFare: isFree ? 0 : stop.monthlyFare });
    }
  }

  saveAllocation(): void {
    if (this.allocationForm.invalid) return;
    const formVal = this.allocationForm.value;
    const dto: CreateTransportAllocationDto = {
      memberType: formVal.memberType,
      studentId: formVal.memberType === 'Student' ? formVal.studentId : undefined,
      teacherId: formVal.memberType === 'Teacher' ? formVal.teacherId : undefined,
      routeId: formVal.routeId,
      routeStopId: formVal.routeStopId,
      vehicleId: formVal.vehicleId,
      pickupDropType: formVal.pickupDropType,
      monthlyFare: formVal.isFreeAllocation ? 0 : formVal.monthlyFare,
      isFreeAllocation: formVal.isFreeAllocation,
      effectiveFrom: formVal.effectiveFrom,
      remarks: formVal.remarks
    };

    if (this.editingAllocationId) {
      this.transportService.updateAllocation(this.editingAllocationId, dto).subscribe({
        next: () => {
          this.showAllocationModal = false;
          this.editingAllocationId = null;
          this.loadAllocations();
          this.loadOverview();
          this.confirmDialog.alert('Pass Updated', 'Transport pass updated successfully! Monthly fare and billing details have been updated.', 'success');
        },
        error: (err) => this.confirmDialog.alert('Update Failed', err.error?.message || 'Failed to update transport pass.', 'danger')
      });
    } else {
      this.transportService.allocateTransport(dto).subscribe({
        next: () => {
          this.showAllocationModal = false;
          this.loadAllocations();
          this.loadOverview();
          this.confirmDialog.alert('Pass Issued', 'Transport pass allocated and smart card generated successfully!', 'success');
        },
        error: (err) => this.confirmDialog.alert('Allocation Failed', err.error?.message || 'Failed to allocate transport.', 'danger')
      });
    }
  }

  discontinueAllocation(a: TransportAllocationDto): void {
    const commuterName = a.studentName || a.teacherName || 'Commuter';
    this.confirmDialog.danger(
      'Discontinue Transport Pass',
      `Are you sure you want to discontinue transport service for ${commuterName} (Route: ${a.routeCode})?`,
      'Discontinue Pass'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.discontinueAllocation(a.id).subscribe({
        next: () => {
          this.loadAllocations();
          this.loadOverview();
          this.confirmDialog.alert('Pass Discontinued', `Transport service for ${commuterName} discontinued.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Operation Failed', err.error?.message || 'Failed to discontinue service.', 'danger')
      });
    });
  }

  viewBusPass(allocationId: string): void {
    this.transportService.getBusPass(allocationId).subscribe({
      next: (res) => {
        this.selectedBusPass = res;
        this.showBusPassModal = true;
      }
    });
  }

  printBusPass(): void {
    window.print();
  }

  // --- Manifest ---

  loadManifest(): void {
    if (!this.manifestRouteId) return;
    this.transportService.getManifest(this.manifestRouteId, this.manifestDeparture).subscribe({
      next: (res) => {
        if (res && res.passengers) {
          res.passengers.forEach(p => {
            p.isBoarded = (p.isBoarded !== undefined ? p.isBoarded : p.isPresent) ?? false;
          });
        }
        this.manifest = res;
      },
      error: (err) => console.error('Failed to load boarding manifest', err)
    });
  }

  printManifest(): void {
    window.print();
  }

  getRollSegments(code?: string | null): string[] {
    if (!code) return [];
    return code.split(' • ').map(s => s.trim()).filter(s => !!s);
  }

  getBoardedCount(): number {
    return (this.manifest?.passengers || []).filter(p => p.isBoarded).length;
  }

  toggleAllBoarded(markAll: boolean): void {
    if (!this.manifest?.passengers) return;
    this.manifest.passengers.forEach(p => p.isBoarded = markAll);
  }

  openQrScanModal(): void {
    this.showQrScanModal = true;
    this.qrScanInput = '';
    this.qrScanSuccessMsg = '';
    this.qrScanError = '';
  }

  processQrScan(): void {
    if (!this.qrScanInput?.trim()) {
      this.qrScanError = 'Please scan or enter a Bus Pass QR code or Roll Number.';
      return;
    }
    const query = this.qrScanInput.trim();
    this.qrScanError = '';
    this.qrScanSuccessMsg = '';

    // Check if matching commuter in currently loaded manifest
    if (this.manifest?.passengers?.length) {
      const match = this.manifest.passengers.find(p => {
        const code = (p.code || p.rollOrEmpCode || '').toLowerCase();
        const name = (p.name || p.memberName || '').toLowerCase();
        const qLower = query.toLowerCase();
        return (code && qLower.includes(code)) || (name && qLower.includes(name)) || (p.stopName && qLower.includes(p.stopName.toLowerCase()));
      });

      if (match) {
        match.isBoarded = true;
        const displayName = match.name || match.memberName;
        this.qrScanSuccessMsg = `Verified & Boarded: ${displayName} (${match.code || match.rollOrEmpCode}) at ${match.stopName}!`;
        this.confirmDialog.alert('Commuter Boarded', `Verified & Boarded: ${displayName} at ${match.stopName}.`, 'success');
        this.qrScanInput = '';
        return;
      }
    }

    // Call backend to verify QR
    this.transportService.verifyPassQr(query).subscribe({
      next: (res) => {
        if (res.success) {
          const p = this.manifest?.passengers?.find(pass => pass.code === res.code || (res.name && (pass.name === res.name || pass.memberName === res.name)));
          if (p) {
            p.isBoarded = true;
          }
          this.qrScanSuccessMsg = `Verified: ${res.name} (ID: ${res.code || 'N/A'}) • Stop: ${res.stopName || 'N/A'} • Route: ${res.routeCode || 'N/A'}`;
          this.confirmDialog.alert('Pass Verified & Boarded', `Verified & Boarded: ${res.name} (Route: ${res.routeCode || 'N/A'}, Stop: ${res.stopName || 'N/A'})`, 'success');
          this.qrScanInput = '';
        } else {
          this.qrScanError = 'Pass verification failed. Invalid or unrecognized QR format.';
          this.confirmDialog.alert('Verification Failed', 'Invalid or unrecognized QR format.', 'warning');
        }
      },
      error: () => {
        this.qrScanError = 'Pass verification failed. QR code not found in transport records.';
        this.confirmDialog.alert('Verification Failed', 'QR code not found in active transport records.', 'danger');
      }
    });
  }

  saveBoardingRun(): void {
    if (!this.manifest || !this.manifestRouteId) {
      this.confirmDialog.alert('Select Route', 'Please select a route to save boarding attendance.', 'warning');
      return;
    }

    this.isSavingBoarding = true;
    const passengersPayload = (this.manifest.passengers || []).map(p => ({
      memberType: p.memberType,
      name: p.name || p.memberName || '',
      code: p.code || p.rollOrEmpCode || '',
      stopName: p.stopName,
      isBoarded: !!p.isBoarded,
      phone: p.parentPhone || p.contactNumber || ''
    }));

    const payload = {
      routeId: this.manifestRouteId,
      departureType: this.manifestDeparture,
      passengers: passengersPayload,
      sendWhatsAppAlerts: false
    };

    this.transportService.saveBoardingAttendance(this.manifestRouteId, payload).subscribe({
      next: (res) => {
        this.isSavingBoarding = false;
        this.loadManifest();
        this.confirmDialog.alert('Boarding Run Saved', res.message || 'Boarding attendance saved successfully for this departure run!', 'success');
      },
      error: () => {
        this.isSavingBoarding = false;
        this.confirmDialog.alert('Save Failed', 'Failed to save boarding run to database. Please try again.', 'danger');
      }
    });
  }

  notifyBoardedParents(): void {
    if (!this.manifest || !this.manifestRouteId) return;

    const boarded = (this.manifest.passengers || []).filter(p => p.isBoarded);
    if (boarded.length === 0) {
      this.confirmDialog.alert('No Commuters Boarded', 'No commuters are marked as Boarded yet. Please check commuters who have boarded first before notifying parents.', 'warning');
      return;
    }

    this.isNotifyingParents = true;
    const passengersPayload = (this.manifest.passengers || []).map(p => ({
      memberType: p.memberType,
      name: p.name || p.memberName || '',
      code: p.code || p.rollOrEmpCode || '',
      stopName: p.stopName,
      isBoarded: !!p.isBoarded,
      phone: p.parentPhone || p.contactNumber || ''
    }));

    const payload = {
      routeId: this.manifestRouteId,
      departureType: this.manifestDeparture,
      passengers: passengersPayload
    };

    this.transportService.notifyBoardedParents(this.manifestRouteId, payload).subscribe({
      next: (res) => {
        this.isNotifyingParents = false;
        this.confirmDialog.alert('WhatsApp Notifications Dispatched', res.message || 'Safe transit WhatsApp alerts dispatched to parents successfully!', 'success');
      },
      error: () => {
        this.isNotifyingParents = false;
        this.confirmDialog.alert('Dispatch Failed', 'Error dispatching WhatsApp alerts. Check gateway logs.', 'danger');
      }
    });
  }

  // --- Gate Passes ---

  openAddGatePass(): void {
    this.activeTopAction = 'gatePass';
    this.selectedGatePassClassFilter = 'ALL';
    this.selectedGatePassStudentInfo = '';
    this.rebuildGatePassGroups();
    this.gatePassForm.reset({
      passType: 'StudentEarlyExit',
      purpose: '',
      outDateTime: this.getNowLocalDateTimeString(),
      approvedBy: 'Admin',
      securityGuardName: 'Main Gate Guard',
      passengerCount: 1,
      remarks: ''
    });
    this.showGatePassModal = true;
  }

  saveGatePass(): void {
    if (this.gatePassForm.invalid) return;
    const dto: CreateCampusGatePassDto = this.gatePassForm.value;
    this.transportService.createGatePass(dto).subscribe({
      next: () => {
        this.showGatePassModal = false;
        this.loadGatePasses();
        this.loadOverview();
        this.confirmDialog.alert('Gate Pass Issued', `Gate pass issued successfully for ${dto.personName || 'commuter'}.`, 'success');
      },
      error: (err) => this.confirmDialog.alert('Issue Failed', err.error?.message || 'Failed to issue gate pass.', 'danger')
    });
  }

  openCloseGatePass(gp: CampusGatePassDto): void {
    this.selectedGatePassForClose = gp;
    this.closePassForm.reset({
      actualInDateTime: this.getNowLocalDateTimeString(),
      remarks: 'Returned safely'
    });
    this.showClosePassModal = true;
  }

  saveCloseGatePass(): void {
    if (!this.selectedGatePassForClose) return;
    const passNo = this.selectedGatePassForClose.passNumber;
    this.confirmDialog.confirm(
      'Close Campus Gate Pass',
      `Are you sure you want to mark Gate Pass "${passNo}" as returned and closed?`,
      'Close Pass',
      'Cancel',
      'info'
    ).subscribe(confirmed => {
      if (!confirmed) return;
      this.transportService.closeGatePass(this.selectedGatePassForClose!.id, this.closePassForm.value).subscribe({
        next: () => {
          this.showClosePassModal = false;
          this.loadGatePasses();
          this.confirmDialog.alert('Gate Pass Closed', `Gate pass "${passNo}" closed successfully.`, 'success');
        },
        error: (err) => this.confirmDialog.alert('Close Failed', err.error?.message || 'Failed to close gate pass.', 'danger')
      });
    });
  }

  confirmCloseGatePass(): void {
    this.saveCloseGatePass();
  }

  // Helpers & Grouping
  getStopsForSelectedRoute(): TransportRouteStopDto[] {
    const routeId = this.allocationForm.get('routeId')?.value;
    if (!routeId) return [];
    const r = this.routes.find(x => x.id === routeId);
    return r?.stops || [];
  }

  getStudentClassName(s: any): string {
    if (s.className && s.className.trim()) {
      const sec = s.sectionName && s.sectionName.trim() ? ` - ${s.sectionName.trim()}` : '';
      return `${s.className.trim()}${sec}`;
    }
    if (s.batchName && s.batchName.trim()) {
      return `Batch: ${s.batchName.trim()}`;
    }
    return 'General / Unassigned';
  }

  availableClasses: { name: string; count: number }[] = [];
  allocationStudentGroups: { groupName: string; students: any[] }[] = [];
  gatePassStudentGroups: { groupName: string; students: any[] }[] = [];
  selectedAllocationStudentInfo = '';
  selectedGatePassStudentInfo = '';

  rebuildClassFiltersAndGroups(): void {
    // 1. Build School Class options from master (in display order: Nursery to 12th)
    this.schoolClassFilterOptions = [];
    for (const c of this.schoolClasses) {
      const classStudents = this.studentsList.filter(s =>
        s.classId === c.id || (s.className && s.className.trim().toLowerCase() === c.name.trim().toLowerCase())
      );

      this.schoolClassFilterOptions.push({
        key: `CLASS_${c.id}`,
        name: c.name,
        count: classStudents.length,
        classId: c.id,
        type: 'class'
      });

      if (c.sections && c.sections.length > 0) {
        for (const sec of c.sections) {
          const secStudents = classStudents.filter(s =>
            s.sectionId === sec.id || (s.sectionName && s.sectionName.trim().toLowerCase() === sec.name.trim().toLowerCase())
          );
          this.schoolClassFilterOptions.push({
            key: `SECTION_${c.id}_${sec.id}`,
            name: `${c.name} - ${sec.name}`,
            count: secStudents.length,
            classId: c.id,
            sectionId: sec.id,
            type: 'section'
          });
        }
      }
    }

    // 2. Build Coaching Batch options from master
    this.batchFilterOptions = [];
    for (const b of this.batchesList) {
      const batchStudents = this.studentsList.filter(s =>
        s.batchId === b.id || (s.batchName && s.batchName.trim().toLowerCase() === b.name.trim().toLowerCase())
      );
      this.batchFilterOptions.push({
        key: `BATCH_${b.id}`,
        name: b.name,
        count: batchStudents.length,
        batchId: b.id
      });
    }

    // Maintain availableClasses for any legacy reference
    this.availableClasses = this.schoolClassFilterOptions.map(x => ({ name: x.name, count: x.count }));

    this.rebuildAllocationGroups();
    this.rebuildGatePassGroups();
  }

  filterStudentsBySelection(filterKey: string, students: any[]): any[] {
    if (!filterKey || filterKey === 'ALL') return students;

    if (filterKey.startsWith('CLASS_')) {
      const classId = filterKey.replace('CLASS_', '');
      const cls = this.schoolClasses.find(c => c.id === classId);
      const className = cls?.name?.trim().toLowerCase();
      return students.filter(s => s.classId === classId || (className && s.className && s.className.trim().toLowerCase() === className));
    }

    if (filterKey.startsWith('SECTION_')) {
      const parts = filterKey.split('_');
      const classId = parts[1];
      const sectionId = parts[2];
      const cls = this.schoolClasses.find(c => c.id === classId);
      const className = cls?.name?.trim().toLowerCase();
      const sec = cls?.sections?.find(sc => sc.id === sectionId);
      const secName = sec?.name?.trim().toLowerCase();

      return students.filter(s => {
        const matchesClass = s.classId === classId || (className && s.className && s.className.trim().toLowerCase() === className);
        const matchesSec = s.sectionId === sectionId || (secName && s.sectionName && s.sectionName.trim().toLowerCase() === secName);
        return matchesClass && matchesSec;
      });
    }

    if (filterKey.startsWith('BATCH_')) {
      const batchId = filterKey.replace('BATCH_', '');
      const b = this.batchesList.find(x => x.id === batchId);
      const batchName = b?.name?.trim().toLowerCase();
      return students.filter(s => s.batchId === batchId || (batchName && s.batchName && s.batchName.trim().toLowerCase() === batchName));
    }

    // Fallback: match by student class name string (for backward compatibility)
    return students.filter(s => this.getStudentClassName(s) === filterKey);
  }

  rebuildAllocationGroups(): void {
    const list = this.filterStudentsBySelection(this.selectedAllocationClassFilter, this.studentsList);

    const map = new Map<string, any[]>();
    for (const s of list) {
      const grp = this.getStudentClassName(s);
      if (!map.has(grp)) {
        map.set(grp, []);
      }
      map.get(grp)!.push(s);
    }

    this.allocationStudentGroups = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, students]) => ({
        groupName: `${groupName} (${students.length})`,
        students: students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''))
      }));
  }

  rebuildGatePassGroups(): void {
    const list = this.filterStudentsBySelection(this.selectedGatePassClassFilter, this.studentsList);

    const map = new Map<string, any[]>();
    for (const s of list) {
      const grp = this.getStudentClassName(s);
      if (!map.has(grp)) {
        map.set(grp, []);
      }
      map.get(grp)!.push(s);
    }

    this.gatePassStudentGroups = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupName, students]) => ({
        groupName: `${groupName} (${students.length})`,
        students: students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''))
      }));
  }

  onAllocationClassFilterChange(): void {
    this.rebuildAllocationGroups();
    const currentStudentId = this.allocationForm.get('studentId')?.value;
    if (currentStudentId && this.selectedAllocationClassFilter !== 'ALL') {
      const filtered = this.filterStudentsBySelection(this.selectedAllocationClassFilter, this.studentsList);
      if (!filtered.some(s => s.id === currentStudentId)) {
        this.allocationForm.patchValue({ studentId: null });
        this.selectedAllocationStudentInfo = '';
      }
    }
  }

  onGatePassClassFilterChange(): void {
    this.rebuildGatePassGroups();
    const currentStudentId = this.gatePassForm.get('studentId')?.value;
    if (currentStudentId && this.selectedGatePassClassFilter !== 'ALL') {
      const filtered = this.filterStudentsBySelection(this.selectedGatePassClassFilter, this.studentsList);
      if (!filtered.some(s => s.id === currentStudentId)) {
        this.gatePassForm.patchValue({ studentId: null });
        this.selectedGatePassStudentInfo = '';
      }
    }
  }

  onAllocationStudentSelect(studentId: string): void {
    this.selectedAllocationStudentInfo = this.formatStudentInfo(studentId);
  }

  onGatePassStudentSelect(studentId: string): void {
    this.selectedGatePassStudentInfo = this.formatStudentInfo(studentId);
  }

  formatStudentInfo(id: string): string {
    const s = this.studentsList.find(x => x.id === id);
    if (!s) return '';
    const cls = this.getStudentClassName(s);
    const roll = s.schoolRollNumber || s.rollNumber || s.coachingRollNumber;
    const adm = s.admissionNumber ? ` • Adm: ${s.admissionNumber}` : '';
    return `${s.studentName} (${cls}${roll ? ' • Roll: ' + roll : ''}${adm})`;
  }
}
