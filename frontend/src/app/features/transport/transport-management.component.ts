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

  constructor(
    private transportService: TransportService,
    private fb: FormBuilder,
    private http: HttpClient
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
      effectiveFrom: [new Date().toISOString().substring(0, 10), [Validators.required]],
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
      outDateTime: [new Date().toISOString().substring(0, 16), [Validators.required]],
      expectedInDateTime: [''],
      approvedBy: ['Admin'],
      securityGuardName: ['Main Gate Guard'],
      passengerCount: [1],
      remarks: ['']
    });

    this.closePassForm = this.fb.group({
      actualInDateTime: [new Date().toISOString().substring(0, 16)],
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
    this.http.get<any[]>('http://localhost:5000/api/students').subscribe({
      next: (res) => {
        this.studentsList = res || [];
        this.rebuildClassFiltersAndGroups();
      },
      error: () => {}
    });

    this.http.get<any[]>('http://localhost:5000/api/teachers?activeOnly=true').subscribe({
      next: (res) => this.teachersList = res || [],
      error: () => {}
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
      this.transportService.updateVehicle(this.editingVehicleId, val).subscribe({
        next: () => {
          this.showVehicleModal = false;
          this.loadVehicles();
          this.loadOverview();
        }
      });
    } else {
      this.transportService.createVehicle(val).subscribe({
        next: () => {
          this.showVehicleModal = false;
          this.loadVehicles();
          this.loadOverview();
        }
      });
    }
  }

  toggleVehicle(v: TransportVehicleDto): void {
    this.transportService.toggleVehicleActive(v.id).subscribe({
      next: () => this.loadVehicles()
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
      this.transportService.updateDriver(this.editingDriverId, val).subscribe({
        next: () => {
          this.showDriverModal = false;
          this.loadDrivers();
        }
      });
    } else {
      this.transportService.createDriver(val).subscribe({
        next: () => {
          this.showDriverModal = false;
          this.loadDrivers();
        }
      });
    }
  }

  toggleDriver(d: TransportDriverDto): void {
    this.transportService.toggleDriverActive(d.id).subscribe({
      next: () => this.loadDrivers()
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
      this.transportService.updateRoute(this.editingRouteId, val).subscribe({
        next: () => {
          this.showRouteModal = false;
          this.loadRoutes();
        }
      });
    } else {
      this.transportService.createRoute(val).subscribe({
        next: () => {
          this.showRouteModal = false;
          this.loadRoutes();
          this.loadOverview();
        }
      });
    }
  }

  toggleRoute(r: TransportRouteDto): void {
    this.transportService.toggleRouteActive(r.id).subscribe({
      next: () => this.loadRoutes()
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
      this.transportService.updateStop(this.editingStopId, val).subscribe({
        next: () => {
          this.showStopModal = false;
          this.loadRoutes();
        }
      });
    } else {
      this.transportService.createStop(this.selectedRouteForStops.id, val).subscribe({
        next: () => {
          this.showStopModal = false;
          this.loadRoutes();
        }
      });
    }
  }

  deleteStop(s: TransportRouteStopDto): void {
    if (!confirm(`Are you sure you want to remove stop "${s.stopName}"?`)) return;
    this.transportService.deleteStop(s.id).subscribe({
      next: () => this.loadRoutes(),
      error: (err) => alert(err.error?.message || 'Cannot delete stop.')
    });
  }

  // --- Allocations (Passes) ---

  openAddAllocation(memberType: 'Student' | 'Teacher' = 'Student'): void {
    this.selectedAllocationClassFilter = 'ALL';
    this.selectedAllocationStudentInfo = '';
    this.rebuildAllocationGroups();
    this.allocationForm.reset({
      memberType,
      pickupDropType: 'Both',
      isFreeAllocation: false,
      monthlyFare: 0,
      effectiveFrom: new Date().toISOString().substring(0, 10),
      remarks: ''
    });
    this.showAllocationModal = true;
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

    this.transportService.allocateTransport(dto).subscribe({
      next: () => {
        this.showAllocationModal = false;
        this.loadAllocations();
        this.loadOverview();
      },
      error: (err) => alert(err.error?.message || 'Failed to allocate transport.')
    });
  }

  discontinueAllocation(a: TransportAllocationDto): void {
    if (!confirm(`Are you sure you want to discontinue transport for ${a.studentName || a.teacherName}?`)) return;
    this.transportService.discontinueAllocation(a.id).subscribe({
      next: () => {
        this.loadAllocations();
        this.loadOverview();
      }
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
      next: (res) => this.manifest = res,
      error: (err) => console.error('Failed to load boarding manifest', err)
    });
  }

  printManifest(): void {
    window.print();
  }

  // --- Gate Passes ---

  openAddGatePass(): void {
    this.selectedGatePassClassFilter = 'ALL';
    this.selectedGatePassStudentInfo = '';
    this.rebuildGatePassGroups();
    this.gatePassForm.reset({
      passType: 'StudentEarlyExit',
      purpose: '',
      outDateTime: new Date().toISOString().substring(0, 16),
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
      },
      error: (err) => alert(err.error?.message || 'Failed to issue gate pass.')
    });
  }

  openCloseGatePass(gp: CampusGatePassDto): void {
    this.selectedGatePassForClose = gp;
    this.closePassForm.reset({
      actualInDateTime: new Date().toISOString().substring(0, 16),
      remarks: 'Returned safely'
    });
    this.showClosePassModal = true;
  }

  saveCloseGatePass(): void {
    if (!this.selectedGatePassForClose) return;
    this.transportService.closeGatePass(this.selectedGatePassForClose.id, this.closePassForm.value).subscribe({
      next: () => {
        this.showClosePassModal = false;
        this.loadGatePasses();
      }
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
    const counts = new Map<string, number>();
    for (const s of this.studentsList) {
      const cls = this.getStudentClassName(s);
      counts.set(cls, (counts.get(cls) || 0) + 1);
    }
    this.availableClasses = Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.rebuildAllocationGroups();
    this.rebuildGatePassGroups();
  }

  rebuildAllocationGroups(): void {
    let list = this.studentsList;
    if (this.selectedAllocationClassFilter && this.selectedAllocationClassFilter !== 'ALL') {
      list = list.filter(s => this.getStudentClassName(s) === this.selectedAllocationClassFilter);
    }

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
    let list = this.studentsList;
    if (this.selectedGatePassClassFilter && this.selectedGatePassClassFilter !== 'ALL') {
      list = list.filter(s => this.getStudentClassName(s) === this.selectedGatePassClassFilter);
    }

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
      const student = this.studentsList.find(s => s.id === currentStudentId);
      if (student && this.getStudentClassName(student) !== this.selectedAllocationClassFilter) {
        this.allocationForm.patchValue({ studentId: null });
        this.selectedAllocationStudentInfo = '';
      }
    }
  }

  onGatePassClassFilterChange(): void {
    this.rebuildGatePassGroups();
    const currentStudentId = this.gatePassForm.get('studentId')?.value;
    if (currentStudentId && this.selectedGatePassClassFilter !== 'ALL') {
      const student = this.studentsList.find(s => s.id === currentStudentId);
      if (student && this.getStudentClassName(student) !== this.selectedGatePassClassFilter) {
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
    const roll = s.rollNumber || s.schoolRollNumber || s.coachingRollNumber;
    return `${s.studentName} (${cls}${roll ? ' • Roll ' + roll : ''})`;
  }
}
