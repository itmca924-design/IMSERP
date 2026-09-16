import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RoomDto, RoomService } from '../../core/services/room.service';
import { BranchDto, BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { RoomDialogComponent } from './room-dialog.component';

@Component({
  selector: 'app-rooms',
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
    MatDialogModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  template: `
    <div class="rooms-container">
      <!-- Standard Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Classrooms & Rooms Master</h1>
          <p class="page-subtitle">Manage institute rooms, seat capacities, floors, and branch associations for batch scheduling.</p>
        </div>
        <button mat-raised-button color="primary" class="add-btn" (click)="openAddRoomModal()">
          <mat-icon>add</mat-icon>
          <span>Add New Classroom</span>
        </button>
      </div>

      <!-- KPI Stats -->
      <div class="stats-row">
        <mat-card class="stat-card">
          <div class="stat-icon-wrapper bg-blue">
            <mat-icon>meeting_room</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total Rooms</span>
            <span class="stat-value">{{ rooms.length }}</span>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon-wrapper bg-green">
            <mat-icon>chair</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-label">Total Seating Capacity</span>
            <span class="stat-value">{{ totalCapacity }} seats</span>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon-wrapper bg-purple">
            <mat-icon>class</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-label">Batches Hosted</span>
            <span class="stat-value">{{ totalBatchesHosted }}</span>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon-wrapper bg-amber">
            <mat-icon>apartment</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-label">Active Branches</span>
            <span class="stat-value">{{ branches.length }}</span>
          </div>
        </mat-card>
      </div>

      <!-- Filter Toolbar -->
      <mat-card class="filter-card">
        <div class="filter-row">
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input
              type="text"
              [(ngModel)]="searchQuery"
              placeholder="Search room number, floor, or branch..."
              class="search-input"
            />
            <button *ngIf="searchQuery" mat-icon-button class="clear-btn" (click)="searchQuery = ''">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="filter-actions">
            <mat-form-field appearance="outline" class="branch-select-field">
              <mat-label>Filter by Branch</mat-label>
              <mat-select [(ngModel)]="selectedBranchFilter" (selectionChange)="loadRooms()">
                <mat-option value="">All Branches</mat-option>
                <mat-option *ngFor="let b of branches" [value]="b.id">
                  {{ b.name }} {{ b.isMainBranch ? '(Main)' : '' }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <button mat-stroked-button class="refresh-btn" (click)="loadData()">
              <mat-icon>refresh</mat-icon>
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <mat-progress-bar *ngIf="loading" mode="indeterminate" class="loading-bar"></mat-progress-bar>
      </mat-card>

      <!-- Rooms Grid -->
      <div class="rooms-grid" *ngIf="!loading && filteredRooms.length > 0">
        <mat-card *ngFor="let r of filteredRooms" class="room-card" [class.inactive-room]="!r.isActive">
          <div class="room-card-header">
            <div class="room-title-box">
              <span class="room-num">{{ r.roomNumber }}</span>
              <span class="branch-pill">
                <mat-icon class="tiny-icon">apartment</mat-icon>
                {{ r.branchName || 'Main Campus' }}
              </span>
            </div>
            <span class="status-pill" [class.active]="r.isActive" [class.inactive]="!r.isActive">
              {{ r.isActive ? 'Active' : 'Inactive' }}
            </span>
          </div>

          <div class="room-card-body">
            <div class="info-row">
              <div class="meta-item">
                <mat-icon class="meta-icon">chair</mat-icon>
                <span><strong>{{ r.capacity }}</strong> Max Seats</span>
              </div>
              <div class="meta-item">
                <mat-icon class="meta-icon">stairs</mat-icon>
                <span>{{ r.floor || 'Ground Floor' }}</span>
              </div>
            </div>

            <div class="batch-badge">
              <mat-icon class="batch-icon">groups</mat-icon>
              <span>{{ r.activeBatchCount }} Active Batch{{ r.activeBatchCount === 1 ? '' : 'es' }} Assigned</span>
            </div>
          </div>

          <div class="room-card-footer">
            <button mat-button class="btn-edit" (click)="openEditRoomModal(r)">
              <mat-icon>edit</mat-icon>
              <span>Edit</span>
            </button>

            <button
              mat-button
              [color]="r.isActive ? 'warn' : 'primary'"
              (click)="toggleStatus(r)"
            >
              <mat-icon>{{ r.isActive ? 'block' : 'check_circle' }}</mat-icon>
              <span>{{ r.isActive ? 'Deactivate' : 'Activate' }}</span>
            </button>

            <button
              *ngIf="r.activeBatchCount === 0"
              mat-icon-button
              color="warn"
              matTooltip="Delete Classroom"
              (click)="deleteRoom(r)"
            >
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
        </mat-card>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="!loading && filteredRooms.length === 0">
        <mat-icon class="empty-icon">meeting_room</mat-icon>
        <h3>No Classrooms Found</h3>
        <p>There are no rooms matching your search or branch criteria.</p>
        <button mat-flat-button class="action-btn-primary" (click)="openAddRoomModal()">
          <mat-icon>add</mat-icon>
          <span>Add Classroom</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .rooms-container {
      padding: 0;
      max-width: 1400px;
      margin: 0 auto;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;

      .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #1976d2;
      }
      .page-subtitle {
        color: #64748b;
        margin: 4px 0 0 0;
        font-size: 0.9rem;
      }
    }

    .add-btn {
      font-weight: 600;
      border-radius: 8px;
      padding: 0 18px;
      height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .action-btn-primary {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%) !important;
      color: white !important;
      font-weight: 600;
      border-radius: 10px;
      padding: 10px 20px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
      flex-shrink: 0;
      white-space: nowrap;
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      padding: 16px 18px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      gap: 14px;
      min-width: 0;
      box-sizing: border-box;
    }

    .stat-icon-wrapper {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-icon-wrapper mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .bg-blue { background: #eff6ff; color: #2563eb; }
    .bg-green { background: #f0fdf4; color: #16a34a; }
    .bg-purple { background: #faf5ff; color: #9333ea; }
    .bg-amber { background: #fffbeb; color: #d97706; }

    .stat-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .stat-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Filter Toolbar */
    .filter-card {
      padding: 14px 18px;
      border-radius: 14px;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      position: relative;
      box-sizing: border-box;
    }

    .filter-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }

    .search-box {
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 6px 12px;
      min-width: 0;
      flex: 1 1 260px;
      max-width: 100%;
      box-sizing: border-box;
    }

    .search-icon {
      color: #94a3b8;
      margin-right: 8px;
      flex-shrink: 0;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 14px;
      width: 100%;
      color: #1e293b;
      min-width: 0;
    }

    .filter-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      flex-shrink: 0;
    }

    .branch-select-field {
      width: 220px;
      margin-bottom: -1.25em;
    }

    .refresh-btn {
      border-radius: 10px;
      height: 48px;
    }

    .loading-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }

    /* Rooms Grid */
    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      gap: 18px;
    }

    .room-card {
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      min-width: 0;
      box-sizing: border-box;
    }

    .room-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }

    .inactive-room {
      opacity: 0.7;
      background: #f8fafc;
    }

    .room-card-header {
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 1px solid #f1f5f9;
      gap: 10px;
    }

    .room-title-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .room-num {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .branch-pill {
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .tiny-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .status-pill.active {
      background: #dcfce7;
      color: #15803d;
    }

    .status-pill.inactive {
      background: #fee2e2;
      color: #b91c1c;
    }

    .room-card-body {
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      flex: 1;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #334155;
    }

    .meta-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #64748b;
      flex-shrink: 0;
    }

    .batch-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #2563eb;
      word-break: break-word;
    }

    .batch-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    .room-card-footer {
      padding: 10px 14px;
      background: #fafafa;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      border-radius: 0 0 14px 14px;
      flex-wrap: wrap;
    }

    .btn-edit {
      color: #2563eb;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 50px 16px;
      background: white;
      border-radius: 16px;
      border: 1px dashed #cbd5e1;
    }

    .empty-icon {
      font-size: 50px;
      width: 50px;
      height: 50px;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .empty-state h3 {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 6px;
    }

    .empty-state p {
      color: #64748b;
      font-size: 14px;
      margin-bottom: 18px;
    }

    /* RESPONSIVE MEDIA QUERIES FOR TABLET AND MOBILE */
    @media (max-width: 860px) {
      .header-card {
        flex-direction: column;
        align-items: stretch;
        padding: 20px;
        gap: 14px;
      }

      .action-btn-primary {
        width: 100%;
        justify-content: center;
        height: 44px;
      }

      .stats-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 680px) {
      .header-text h1 {
        font-size: 20px;
      }

      .header-text p {
        font-size: 13px;
      }

      .stats-row {
        grid-template-columns: 1fr;
        gap: 10px;
      }

      .stat-card {
        padding: 12px 14px;
      }

      .filter-card {
        padding: 12px 14px;
      }

      .filter-row {
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .search-box {
        width: 100%;
        flex: none;
      }

      .filter-actions {
        width: 100%;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }

      .branch-select-field {
        width: 100%;
        margin-bottom: 0;
      }

      .refresh-btn {
        width: 100%;
        justify-content: center;
        height: 42px;
      }

      .rooms-grid {
        grid-template-columns: 1fr;
        gap: 14px;
      }
    }

    @media (max-width: 480px) {
      .header-card {
        padding: 16px;
        border-radius: 12px;
      }

      .title-row {
        gap: 8px;
      }

      .header-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
      }

      .header-text h1 {
        font-size: 18px;
      }

      .header-text p {
        font-size: 12px;
      }

      .room-card-footer {
        justify-content: space-between;
        padding: 8px 10px;

        button {
          padding: 0 8px;
          font-size: 12px;
        }
      }
    }
  `]
})
export class RoomsComponent implements OnInit {
  rooms: RoomDto[] = [];
  branches: BranchDto[] = [];
  loading = false;
  searchQuery = '';
  selectedBranchFilter = '';

  constructor(
    private roomService: RoomService,
    private branchService: BranchService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.branchService.getBranches().subscribe({
      next: (branches) => {
        this.branches = branches || [];
        this.loadRooms();
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert(
          'Load Error',
          err?.error?.message || 'Failed to load branches.',
          'danger'
        );
      }
    });
  }

  loadRooms(): void {
    this.loading = true;
    this.roomService.getRooms(this.selectedBranchFilter || null).subscribe({
      next: (rooms) => {
        this.rooms = rooms || [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.confirmDialog.alert(
          'Load Error',
          err?.error?.message || 'Failed to load classrooms.',
          'danger'
        );
      }
    });
  }

  get filteredRooms(): RoomDto[] {
    if (!this.searchQuery.trim()) return this.rooms;
    const q = this.searchQuery.trim().toLowerCase();
    return this.rooms.filter(
      (r) =>
        r.roomNumber.toLowerCase().includes(q) ||
        (r.branchName && r.branchName.toLowerCase().includes(q)) ||
        (r.floor && r.floor.toLowerCase().includes(q))
    );
  }

  get totalCapacity(): number {
    return this.rooms.reduce((acc, r) => acc + (r.isActive ? r.capacity : 0), 0);
  }

  get totalBatchesHosted(): number {
    return this.rooms.reduce((acc, r) => acc + r.activeBatchCount, 0);
  }

  openAddRoomModal(): void {
    const dialogRef = this.dialog.open(RoomDialogComponent, {
      width: '540px',
      data: {
        isEditing: false,
        branches: this.branches
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadRooms();
        this.confirmDialog.alert(
          'Classroom Created',
          'New classroom created successfully.',
          'success'
        );
      }
    });
  }

  openEditRoomModal(room: RoomDto): void {
    const dialogRef = this.dialog.open(RoomDialogComponent, {
      width: '540px',
      data: {
        isEditing: true,
        room: { ...room },
        branches: this.branches
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadRooms();
        this.confirmDialog.alert(
          'Classroom Updated',
          'Classroom details updated successfully.',
          'success'
        );
      }
    });
  }

  toggleStatus(room: RoomDto): void {
    this.roomService.toggleRoomStatus(room.id).subscribe({
      next: (res) => {
        room.isActive = res.isActive;
        this.confirmDialog.alert(
          'Status Updated',
          `Classroom "${room.roomNumber}" is now ${res.isActive ? 'Active' : 'Inactive'}.`,
          'success'
        );
      },
      error: (err) => {
        this.confirmDialog.alert(
          'Status Update Failed',
          err?.error?.message || 'Failed to change classroom status.',
          'danger'
        );
      }
    });
  }

  deleteRoom(room: RoomDto): void {
    this.confirmDialog.danger(
      'Delete Classroom',
      `Are you sure you want to delete classroom "${room.roomNumber}"? This action cannot be undone.`,
      'Delete'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.roomService.deleteRoom(room.id).subscribe({
          next: () => {
            this.loadRooms();
            this.confirmDialog.alert(
              'Classroom Deleted',
              `Classroom "${room.roomNumber}" has been deleted.`,
              'success'
            );
          },
          error: (err) => {
            this.loading = false;
            this.confirmDialog.alert(
              'Delete Failed',
              err?.error?.message || 'Cannot delete classroom.',
              'danger'
            );
          }
        });
      }
    });
  }
}
