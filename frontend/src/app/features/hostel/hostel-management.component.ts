import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import {
  HostelService,
  HostelDto,
  CreateHostelDto,
  HostelRoomDto,
  CreateHostelRoomDto,
  HostelBedDto,
  HostelAllocationDto,
  HostelGatePassDto,
  HostelOverviewSummaryDto,
  HostelStudentSearchResultDto,
  GatePassPagedResultDto
} from '../../core/services/hostel.service';
import { CoachingService } from '../../core/services/coaching.service';

const API_BASE = 'http://localhost:5000';

@Component({
  selector: 'app-hostel-management',
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
    MatPaginatorModule,
    MatSortModule,
    ConfirmDialogComponent
  ],
  template: `
    <div class="hostel-page-wrapper">
      <!-- Header Banner -->
      <mat-card class="page-header-card mat-elevation-z1">
        <div class="header-left">
          <div class="header-icon-badge">
            <mat-icon>apartment</mat-icon>
          </div>
          <div class="header-title-box">
            <div class="title-row">
              <h1>Hostel &amp; Residential Management</h1>
              <span class="live-pill"><span class="pulse-dot"></span> Live Facility Hub</span>
              <span class="optional-tag">100% Optional Add-On</span>
            </div>
            <p class="subtitle">
              Integrated boarding facility for <strong>School</strong> &amp; <strong>Coaching</strong> students with automated bed matrix &amp; turnstile biometric sync.
            </p>
          </div>
        </div>

        <div class="header-right-actions">
          <button mat-flat-button color="primary" class="action-btn" (click)="openAddHostelModal()">
            <mat-icon>add_business</mat-icon> Add Hostel Block
          </button>
          <button mat-stroked-button color="primary" class="action-btn" (click)="openAddRoomModal()">
            <mat-icon>meeting_room</mat-icon> Add Room
          </button>
          <button mat-stroked-button class="action-btn" (click)="openGatePassModal()">
            <mat-icon>badge</mat-icon> Issue Gate Pass
          </button>
        </div>
      </mat-card>

      <!-- KPI Summary Cards (Guaranteed 1 Single Line) -->
      <div class="kpi-grid-container" *ngIf="overview">
        <mat-card class="kpi-card hostel-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>domain</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.totalHostels }}</span>
              <span class="kpi-label">Hostel Blocks</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card room-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>hotel</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.totalRooms }}</span>
              <span class="kpi-label">Total Rooms</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card capacity-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>bed</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.totalBeds }}</span>
              <span class="kpi-label">Total Beds</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card occupied-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>groups</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.occupiedBeds }} <small class="pct-badge">{{ overview.occupancyRate }}%</small></span>
              <span class="kpi-label">Occupied Beds</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card vacant-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>check_circle</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.availableBeds }}</span>
              <span class="kpi-label">Vacant Beds</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="kpi-card gatepass-kpi mat-elevation-z1">
          <mat-card-content class="kpi-inner">
            <div class="kpi-icon-wrap"><mat-icon>commute</mat-icon></div>
            <div class="kpi-content">
              <span class="kpi-num">{{ overview.activeGatePasses }}</span>
              <span class="kpi-label">On Gate Pass</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Navigation Tabs -->
      <mat-card class="main-content-card">
        <div class="tabs-nav-bar">
          <button class="nav-tab-btn" [class.active]="activeTab === 'matrix'" (click)="setTab('matrix')">
            <mat-icon>grid_view</mat-icon>
            <span>Visual Bed Matrix</span>
          </button>
          <button class="nav-tab-btn" [class.active]="activeTab === 'hostels'" (click)="setTab('hostels')">
            <mat-icon>apartment</mat-icon>
            <span>Hostels &amp; Rooms Master</span>
          </button>
          <button class="nav-tab-btn" [class.active]="activeTab === 'residents'" (click)="setTab('residents')">
            <mat-icon>people</mat-icon>
            <span>Residents &amp; Allocations</span>
          </button>
          <button class="nav-tab-btn" [class.active]="activeTab === 'gatepass'" (click)="setTab('gatepass')">
            <mat-icon>assignment_ind</mat-icon>
            <span>Gate Passes &amp; Outings</span>
          </button>
          <button class="nav-tab-btn" [class.active]="activeTab === 'rollcall'" (click)="setTab('rollcall')">
            <mat-icon>nightlight_round</mat-icon>
            <span>Night Roll Call</span>
          </button>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <!-- TAB 1: VISUAL BED MATRIX -->
        <div class="tab-pane" *ngIf="activeTab === 'matrix'">
          <div class="matrix-filter-bar">
            <div class="filter-group">
              <mat-form-field appearance="outline" class="dense-field hostel-filter-field">
                <mat-label>Filter by Hostel Block</mat-label>
                <mat-select [(ngModel)]="selectedHostelFilter" (selectionChange)="loadBedMatrix()" panelClass="hostel-block-dropdown-panel">
                  <mat-option value="">All Hostel Blocks</mat-option>
                  <mat-option *ngFor="let h of hostels" [value]="h.id">{{ h.name }} ({{ h.hostelType }})</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="dense-field bed-status-filter-field">
                <mat-label>Filter Bed Status</mat-label>
                <mat-select [(ngModel)]="selectedBedStatusFilter" (selectionChange)="applyMatrixFilter()">
                  <mat-option value="all">All Beds</mat-option>
                  <mat-option value="Available">Vacant / Available Only</mat-option>
                  <mat-option value="Occupied">Occupied Only</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="legend-bar">
              <span class="legend-item"><span class="dot available"></span> Available Bed</span>
              <span class="legend-item"><span class="dot occupied"></span> Occupied Bed</span>
            </div>
          </div>

          <!-- Room Cards Grid -->
          <div class="rooms-grid" *ngIf="filteredMatrixRooms.length > 0; else noRoomsTemplate">
            <div class="room-card" *ngFor="let room of filteredMatrixRooms">
              <div class="room-card-header">
                <div class="room-badge">
                  <mat-icon>meeting_room</mat-icon>
                  <span class="room-num">Room {{ room.roomNumber }}</span>
                </div>
                <div class="room-tags">
                  <span class="tag-pill ac" *ngIf="room.hasAC">AC</span>
                  <span class="tag-pill nonac" *ngIf="!room.hasAC">Non-AC</span>
                  <span class="tag-pill type">{{ room.roomType }}</span>
                  <span class="tag-pill floor">{{ room.floor }}</span>
                </div>
              </div>

              <div class="room-meta">
                <span class="hostel-name-label">{{ room.hostelName }}</span>
                <span class="room-rent-label">₹{{ room.monthlyRent | number }}/mo</span>
              </div>

              <!-- Beds in Room -->
              <div class="beds-list">
                <div
                  class="bed-card"
                  *ngFor="let bed of room.beds"
                  [ngClass]="{
                    'available-bed': bed.status === 'Available',
                    'occupied-bed': bed.status === 'Occupied'
                  }"
                >
                  <div class="bed-header">
                    <span class="bed-code-badge">
                      <mat-icon>bed</mat-icon> {{ bed.bedCode }}
                    </span>
                    <span class="bed-status-pill" [class.vacant]="bed.status === 'Available'">
                      {{ bed.status }}
                    </span>
                  </div>

                  <!-- Available Bed Info -->
                  <div class="bed-body available-body" *ngIf="bed.status === 'Available'">
                    <span class="rent-tag">₹{{ bed.monthlyRent | number }}/mo</span>
                    <button mat-stroked-button color="primary" class="allocate-btn" (click)="openQuickAllocateModal(room, bed)">
                      <mat-icon>add</mat-icon> Allocate
                    </button>
                  </div>

                  <!-- Occupied Bed Info -->
                  <div class="bed-body occupied-body" *ngIf="bed.status === 'Occupied'">
                    <div class="student-avatar-row">
                      <div class="student-avatar">
                        <img *ngIf="bed.profilePhoto" [src]="getPhotoUrl(bed.profilePhoto)" alt="" />
                        <mat-icon *ngIf="!bed.profilePhoto">person</mat-icon>
                      </div>
                      <div class="student-meta">
                        <strong class="student-name-text">{{ bed.studentName }}</strong>
                        <span class="roll-text">Roll: {{ bed.rollNumber || 'N/A' }}</span>
                        <span class="stream-text">{{ bed.classOrBatch }}</span>
                      </div>
                    </div>

                    <div class="bed-actions">
                      <button mat-icon-button color="warn" matTooltip="Vacate Bed" (click)="vacateStudentBed(bed)">
                        <mat-icon>logout</mat-icon>
                      </button>
                      <button mat-icon-button color="primary" matTooltip="Issue Gate Pass" (click)="openGatePassForStudent(bed)">
                        <mat-icon>badge</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <ng-template #noRoomsTemplate>
            <div class="empty-state-box">
              <mat-icon class="empty-icon">hotel</mat-icon>
              <h3>No Rooms or Beds Found</h3>
              <p>Configure your hostel buildings and rooms to start allocating beds to boarding students.</p>
              <button mat-raised-button color="primary" (click)="openAddRoomModal()">
                <mat-icon>add</mat-icon> Add First Room
              </button>
            </div>
          </ng-template>
        </div>

        <!-- TAB 2: HOSTELS & ROOMS MASTER -->
        <div class="tab-pane" *ngIf="activeTab === 'hostels'">
          <div class="hostels-master-grid">
            <div class="hostel-block-card" *ngFor="let h of hostels">
              <div class="block-card-header">
                <div class="block-title-box">
                  <div class="block-icon" [ngClass]="h.hostelType.toLowerCase()">
                    <mat-icon>{{ h.hostelType === 'Girls' ? 'female' : 'male' }}</mat-icon>
                  </div>
                  <div>
                    <h3>{{ h.name }}</h3>
                    <span class="type-pill">{{ h.hostelType }} Hostel</span>
                  </div>
                </div>
                <div class="block-quick-stats">
                  <span class="stat-bubble"><strong>{{ h.totalRooms }}</strong> Rooms</span>
                  <span class="stat-bubble"><strong>{{ h.occupiedBeds }}/{{ h.totalBeds }}</strong> Beds Occupied</span>
                </div>
              </div>

              <div class="block-details">
                <div class="detail-row">
                  <mat-icon>badge</mat-icon>
                  <span>Warden: <strong>{{ h.wardenName || 'Not Assigned' }}</strong> ({{ h.wardenPhone || 'No Phone' }})</span>
                </div>
                <div class="detail-row" *ngIf="h.address">
                  <mat-icon>place</mat-icon>
                  <span>{{ h.address }}</span>
                </div>
                <div class="detail-row">
                  <mat-icon>stairs</mat-icon>
                  <span>Floors: {{ h.totalFloors }}</span>
                </div>
              </div>

              <div class="block-card-footer">
                <button mat-stroked-button color="primary" (click)="openAddRoomForHostel(h)">
                  <mat-icon>add</mat-icon> Add Room to Block
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB 3: RESIDENTS & ALLOCATIONS -->
        <div class="tab-pane" *ngIf="activeTab === 'residents'">
          <div class="residents-toolbar">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Residents...</mat-label>
              <input matInput [(ngModel)]="residentSearch" placeholder="Student name, roll no, room..." />
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>

          <div class="residents-table-wrap" *ngIf="filteredAllocations.length > 0; else noResidents">
            <table class="custom-data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll / SR No</th>
                  <th>Hostel Block</th>
                  <th>Room &amp; Bed</th>
                  <th>Monthly Rent</th>
                  <th>Mess Plan</th>
                  <th>Allotted Date</th>
                  <th>Status</th>
                  <th class="action-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of filteredAllocations">
                  <td>
                    <div class="student-cell">
                      <span class="name">{{ a.studentName }}</span>
                      <small class="class-info">{{ a.classOrBatch }}</small>
                    </div>
                  </td>
                  <td><strong>{{ a.rollNumber || 'N/A' }}</strong></td>
                  <td>{{ a.hostelName }}</td>
                  <td>
                    <span class="bed-pill">Rm {{ a.roomNumber }} - {{ a.bedCode }}</span>
                  </td>
                  <td><strong>₹{{ a.monthlyRent | number }}</strong></td>
                  <td>
                    <span class="mess-pill" [class.included]="a.isMessIncluded">
                      {{ a.isMessIncluded ? a.messPlan : 'No Mess' }}
                    </span>
                  </td>
                  <td>{{ a.allocatedDate | date:'dd MMM yyyy' }}</td>
                  <td>
                    <span class="status-badge" [class.active]="a.status === 'Active'">
                      {{ a.status }}
                    </span>
                  </td>
                  <td class="action-cell">
                    <button
                      *ngIf="a.status === 'Active'"
                      mat-stroked-button
                      color="warn"
                      class="sm-btn"
                      (click)="vacateAllocation(a)"
                    >
                      <mat-icon>logout</mat-icon> Vacate
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <ng-template #noResidents>
            <div class="empty-state-box">
              <mat-icon class="empty-icon">people_outline</mat-icon>
              <h3>No Resident Students Found</h3>
              <p>Allocate vacant beds to students from the Visual Bed Matrix tab or Student Admission form.</p>
            </div>
          </ng-template>
        </div>

        <!-- TAB 4: GATE PASSES & OUTINGS (Angular Material Smart Grid) -->
        <div class="tab-pane" *ngIf="activeTab === 'gatepass'">
          <!-- Top Control Header: Action Button + Filter Pills + Search Input -->
          <div class="gp-control-card mat-elevation-z1">
            <div class="gp-top-row">
              <div class="gp-heading-area">
                <div class="gp-icon-badge"><mat-icon>badge</mat-icon></div>
                <div>
                  <h3 class="gp-title">Student Outing &amp; Gate Passes</h3>
                  <p class="gp-subtitle">Track real-time campus entry/exit, safety return timestamps, and parent consent verification.</p>
                </div>
              </div>

              <div class="gp-actions">
                <button mat-flat-button color="primary" class="issue-gp-btn" (click)="openGatePassModal()">
                  <mat-icon>add_circle</mat-icon> Issue New Gate Pass
                </button>
              </div>
            </div>

            <!-- Filter Pills Bar & Search -->
            <div class="gp-filter-row">
              <div class="gp-status-pills">
                <button type="button" class="gp-pill" [class.active]="gatePassStatusFilter === 'all'" (click)="setGatePassStatusFilter('all')">
                  All Passes <span class="pill-count">{{ gatePassTotalCount }}</span>
                </button>
                <button type="button" class="gp-pill pill-out" [class.active]="gatePassStatusFilter === 'out'" (click)="setGatePassStatusFilter('out')">
                  <span class="live-dot"></span> Currently Out <span class="pill-count">{{ gatePassActiveOutCount }}</span>
                </button>
                <button type="button" class="gp-pill pill-returned" [class.active]="gatePassStatusFilter === 'returned'" (click)="setGatePassStatusFilter('returned')">
                  <mat-icon class="pill-icon">task_alt</mat-icon> Safely Returned <span class="pill-count">{{ gatePassCompletedCount }}</span>
                </button>
                <button type="button" class="gp-pill pill-overdue" [class.active]="gatePassStatusFilter === 'overdue'" (click)="setGatePassStatusFilter('overdue')">
                  <mat-icon class="pill-icon">warning</mat-icon> Overdue / Late <span class="pill-count" [class.warn-alert]="gatePassOverdueCount > 0">{{ gatePassOverdueCount }}</span>
                </button>
              </div>

              <!-- Search Box -->
              <div class="gp-search-wrapper">
                <mat-form-field appearance="outline" class="gp-search-field">
                  <mat-label>Search Gate Passes...</mat-label>
                  <input matInput [(ngModel)]="gatePassSearchQuery" [ngModelOptions]="{standalone: true}" (ngModelChange)="onGatePassSearchChanged($event)" placeholder="Search student, roll, pass #, purpose, room, phone..." autocomplete="off" />
                  <mat-icon matPrefix>search</mat-icon>
                  <button mat-icon-button matSuffix *ngIf="gatePassSearchQuery" (click)="clearGatePassSearch()" type="button" matTooltip="Clear search">
                    <mat-icon>close</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <!-- Server-Side Progress Bar Loader -->
            <mat-progress-bar *ngIf="isGatePassLoading" mode="indeterminate" class="gp-table-loader"></mat-progress-bar>
          </div>

          <!-- Angular Material Smart Grid -->
          <div class="gp-table-card mat-elevation-z1">
            <div class="table-responsive-container">
              <table mat-table [dataSource]="gatePasses" matSort (matSortChange)="onGatePassSortChange($event)" class="gp-mat-table">

                <!-- Pass Number Column -->
                <ng-container matColumnDef="passNumber">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header="passNumber" class="col-pass">Pass No</th>
                  <td mat-cell *matCellDef="let g" class="col-pass">
                    <div class="pass-chip-box">
                      <span class="pass-number-text">{{ g.passNumber }}</span>
                      <small class="pass-date-sub">{{ g.createdAt | date:'dd MMM yyyy' }}</small>
                    </div>
                  </td>
                </ng-container>

                <!-- Student Column -->
                <ng-container matColumnDef="student">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header="student" class="col-student">Student Name</th>
                  <td mat-cell *matCellDef="let g" class="col-student">
                    <div class="student-profile-cell">
                      <div class="student-avatar-badge">
                        {{ g.studentName ? g.studentName[0].toUpperCase() : 'S' }}
                      </div>
                      <div class="student-details-box">
                        <span class="student-name-bold">{{ g.studentName }}</span>
                        <div class="student-sub-info">
                          <span class="student-class-chip" *ngIf="g.classOrBatch">{{ g.classOrBatch }}</span>
                          <span class="student-roll-chip" *ngIf="g.rollNumber">Roll: {{ g.rollNumber }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </ng-container>

                <!-- Room & Bed Column -->
                <ng-container matColumnDef="roomAndBed">
                  <th mat-header-cell *matHeaderCellDef class="col-room">Hostel &amp; Bed</th>
                  <td mat-cell *matCellDef="let g" class="col-room">
                    <div class="room-bed-badge">
                      <mat-icon class="bed-icon">hotel</mat-icon>
                      <span>{{ g.roomAndBed || 'Resident' }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Out Date & Time Column -->
                <ng-container matColumnDef="outDate">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header="outDate" class="col-out-date">Exit Out Date</th>
                  <td mat-cell *matCellDef="let g" class="col-out-date">
                    <div class="date-display-box">
                      <span class="date-main">{{ g.outDate | date:'dd MMM yyyy' }}</span>
                      <span class="time-sub"><mat-icon class="clock-icon">schedule</mat-icon> {{ g.outDate | date:'hh:mm a' }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Expected Return Column -->
                <ng-container matColumnDef="expectedReturn">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header="expectedReturn" class="col-return-date">Expected Return</th>
                  <td mat-cell *matCellDef="let g" class="col-return-date">
                    <div class="date-display-box">
                      <span class="date-main">{{ g.expectedReturnDate | date:'dd MMM yyyy' }}</span>
                      <span class="time-sub"><mat-icon class="clock-icon">event_available</mat-icon> {{ g.expectedReturnDate | date:'hh:mm a' }}</span>
                      <!-- Overdue Warning Pill -->
                      <span class="overdue-chip" *ngIf="isGatePassOverdue(g)">
                        <mat-icon>warning</mat-icon> Late / Overdue
                      </span>
                    </div>
                  </td>
                </ng-container>

                <!-- Purpose Column -->
                <ng-container matColumnDef="purpose">
                  <th mat-header-cell *matHeaderCellDef class="col-purpose">Purpose</th>
                  <td mat-cell *matCellDef="let g" class="col-purpose">
                    <div class="purpose-cell">
                      <span class="purpose-title">{{ g.purpose }}</span>
                      <small class="remarks-sub" *ngIf="g.remarks">{{ g.remarks }}</small>
                    </div>
                  </td>
                </ng-container>

                <!-- Parent Consent Column -->
                <ng-container matColumnDef="parentConsent">
                  <th mat-header-cell *matHeaderCellDef class="col-consent">Parent Consent</th>
                  <td mat-cell *matCellDef="let g" class="col-consent">
                    <div class="consent-cell-box" *ngIf="g.parentConsentGiven">
                      <span class="verified-tag"><mat-icon>verified</mat-icon> Verified</span>
                      <a *ngIf="g.parentContactNumber" [href]="'tel:' + g.parentContactNumber" class="parent-phone-link" matTooltip="Click to call parent">
                        📞 {{ g.parentContactNumber }}
                      </a>
                    </div>
                    <span class="consent-self-tag" *ngIf="!g.parentConsentGiven">Self Authorized</span>
                  </td>
                </ng-container>

                <!-- Status Column -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef mat-sort-header="status" class="col-status">Status</th>
                  <td mat-cell *matCellDef="let g" class="col-status">
                    <span class="smart-status-pill status-overdue" *ngIf="isGatePassOverdue(g)">
                      <mat-icon>priority_high</mat-icon> OVERDUE
                    </span>
                    <span class="smart-status-pill status-out" *ngIf="!isGatePassOverdue(g) && g.wardenApprovalStatus !== 'Completed'">
                      <span class="pulse-indicator"></span> OUTING ACTIVE
                    </span>
                    <span class="smart-status-pill status-completed" *ngIf="g.wardenApprovalStatus === 'Completed'">
                      <mat-icon>done_all</mat-icon> RETURNED
                    </span>
                  </td>
                </ng-container>

                <!-- Action Column -->
                <ng-container matColumnDef="action">
                  <th mat-header-cell *matHeaderCellDef class="col-action text-right">Action</th>
                  <td mat-cell *matCellDef="let g" class="col-action text-right">
                    <button
                      *ngIf="g.wardenApprovalStatus !== 'Completed'"
                      mat-flat-button
                      color="primary"
                      class="smart-return-btn"
                      (click)="markGatePassReturned(g)"
                      matTooltip="Confirm student returned to hostel campus"
                    >
                      <mat-icon>login</mat-icon> Mark Return
                    </button>
                    <div *ngIf="g.wardenApprovalStatus === 'Completed'" class="returned-safe-info">
                      <mat-icon class="safe-icon">check_circle</mat-icon>
                      <span class="safe-time">Returned {{ g.actualReturnDate | date:'hh:mm a' }}</span>
                    </div>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedGatePassColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedGatePassColumns;" class="gp-table-row" [class.row-overdue]="isGatePassOverdue(row)"></tr>

                <!-- No Data Row -->
                <tr class="mat-row empty-row" *matNoDataRow>
                  <td class="mat-cell empty-table-cell" [attr.colspan]="displayedGatePassColumns.length">
                    <div class="empty-state-box">
                      <mat-icon class="empty-icon">assignment_late</mat-icon>
                      <h3>No Gate Passes Found</h3>
                      <p *ngIf="gatePassSearchQuery || gatePassStatusFilter !== 'all'">
                        No records match the selected filter/search criteria.
                      </p>
                      <p *ngIf="!gatePassSearchQuery && gatePassStatusFilter === 'all'">
                        No gate passes have been issued yet. Click "Issue New Gate Pass" to record an outing.
                      </p>
                      <button *ngIf="gatePassSearchQuery || gatePassStatusFilter !== 'all'" mat-stroked-button color="primary" (click)="clearGatePassSearch(); setGatePassStatusFilter('all')">
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Material Server-Side Paginator -->
            <mat-paginator
              [length]="gatePassTotalCount"
              [pageSize]="gatePassPageSize"
              [pageIndex]="gatePassPageIndex - 1"
              [pageSizeOptions]="[5, 10, 25, 50]"
              (page)="onGatePassPageChange($event)"
              showFirstLastButtons
              aria-label="Select page of gate passes"
              class="gp-paginator"
            >
            </mat-paginator>
          </div>
        </div>

        <!-- TAB 5: NIGHT ROLL CALL & BIOMETRIC ATTENDANCE -->
        <div class="tab-pane" *ngIf="activeTab === 'rollcall'">
          <!-- Progress loader on roll call fetch -->
          <mat-progress-bar *ngIf="isRollCallLoading" mode="indeterminate" class="rc-progress-bar"></mat-progress-bar>

          <!-- Top Control Header Bar -->
          <div class="rollcall-header-bar">
            <div class="rollcall-inputs">
              <mat-form-field appearance="outline" class="dense-field hostel-select-field">
                <mat-label>Hostel Block</mat-label>
                <mat-select [(ngModel)]="rollCallHostelId" (selectionChange)="loadRollCall()">
                  <mat-option *ngFor="let h of hostels" [value]="h.id">{{ h.name }}</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="dense-field date-field">
                <mat-label>Attendance Date</mat-label>
                <input matInput type="date" [(ngModel)]="rollCallDate" (change)="loadRollCall()" />
              </mat-form-field>

              <!-- Attendance Mode Selector (Manual / Biometric / Both) -->
              <mat-form-field appearance="outline" class="dense-field mode-field">
                <mat-label>Hostel Attendance Mode</mat-label>
                <mat-select [(ngModel)]="hostelAttendanceMode" (selectionChange)="onHostelModeChange($event.value)">
                  <mat-option value="Both">Manual + Biometric (Hybrid)</mat-option>
                  <mat-option value="Manual">Manual Only</mat-option>
                  <mat-option value="Biometric">Biometric Only (Automated)</mat-option>
                </mat-select>
              </mat-form-field>

              <span class="mode-pill hybrid" *ngIf="hostelAttendanceMode === 'Both'">
                <mat-icon>devices</mat-icon> Hybrid Mode
              </span>
              <span class="mode-pill manual" *ngIf="hostelAttendanceMode === 'Manual'">
                <mat-icon>edit_note</mat-icon> Manual Only
              </span>
              <span class="mode-pill biometric" *ngIf="hostelAttendanceMode === 'Biometric'">
                <mat-icon>fingerprint</mat-icon> Biometric Automated
              </span>
            </div>

            <div class="rollcall-actions-right">
              <button
                mat-stroked-button
                color="accent"
                class="action-btn"
                (click)="openBiometricSimulator()"
                [disabled]="hostelAttendanceMode === 'Manual'"
                matTooltip="Simulate turnstile biometric punch for a student"
              >
                <mat-icon>fingerprint</mat-icon> Simulate Biometric Punch
              </button>

              <button
                mat-stroked-button
                class="action-btn"
                (click)="openBiometricMappings()"
                matTooltip="View and update Biometric User IDs for residents"
              >
                <mat-icon>badge</mat-icon> Biometric IDs
              </button>

              <button
                mat-stroked-button
                color="primary"
                class="action-btn"
                (click)="markAllPresent()"
                [disabled]="hostelAttendanceMode === 'Biometric'"
                matTooltip="Mark all active residents as Present"
              >
                <mat-icon>done_all</mat-icon> All Present
              </button>

              <button
                mat-raised-button
                color="primary"
                class="action-btn"
                (click)="saveRollCall()"
                [disabled]="hostelAttendanceMode === 'Biometric' || rollCallStudents.length === 0"
                matTooltip="Save manual roll call records"
              >
                <mat-icon>save</mat-icon> Save Roll Call
              </button>
            </div>
          </div>

          <!-- Alert banner when in Biometric Only Mode -->
          <div class="biometric-locked-alert" *ngIf="hostelAttendanceMode === 'Biometric'">
            <mat-icon>verified_user</mat-icon>
            <div>
              <strong>Biometric Only Mode Active:</strong> Night roll call is automatically populated via physical turnstiles &amp; biometric devices at the hostel gates. Manual modifications are locked. Click "Simulate Biometric Punch" to test turnstile event logs.
            </div>
          </div>

          <!-- Roll Call Students List -->
          <div class="rollcall-list" *ngIf="rollCallStudents.length > 0; else noRollCallStudents">
            <div class="rollcall-item" *ngFor="let s of rollCallStudents">
              <div class="student-info-col">
                <div class="avatar-small">
                  <img *ngIf="s.profilePhoto" [src]="getPhotoUrl(s.profilePhoto)" alt="" />
                  <mat-icon *ngIf="!s.profilePhoto">person</mat-icon>
                </div>
                <div class="student-details-wrap">
                  <div class="name-row">
                    <strong class="name">{{ s.studentName }}</strong>
                    <span class="roll-tag" *ngIf="s.rollNumber">({{ s.rollNumber }})</span>

                    <!-- Biometric ID badge with click to edit -->
                    <span
                      class="bio-id-pill"
                      [class.unmapped]="!s.biometricUserId"
                      (click)="openQuickMapBio(s)"
                      matTooltip="Click to map/edit Biometric User ID"
                    >
                      <mat-icon>fingerprint</mat-icon>
                      {{ s.biometricUserId ? 'Bio ID: ' + s.biometricUserId : '+ Map Bio ID' }}
                    </span>

                    <!-- Capture Source Pill -->
                    <span class="source-pill bio" *ngIf="s.captureSource === 'Biometric'">
                      <mat-icon>fingerprint</mat-icon> Biometric {{ s.punchTime ? '@ ' + s.punchTime : '' }}
                    </span>
                    <span class="source-pill manual" *ngIf="s.captureSource === 'Manual'">
                      <mat-icon>edit_note</mat-icon> Manual
                    </span>

                    <!-- Gate Pass Outing Alert Tag -->
                    <span class="gatepass-pill" *ngIf="s.hasActiveGatePass" [matTooltip]="s.gatePassDetails">
                      <mat-icon>transfer_within_a_station</mat-icon> On Gate Pass Outing
                    </span>
                  </div>

                  <div class="sub-line">
                    <span class="room-tag">Rm {{ s.roomNumber }} - Bed {{ s.bedCode }}</span>
                    <span class="phone-tag" *ngIf="s.parentPhone">📞 Parent: {{ s.parentPhone }}</span>
                    <span class="class-tag" *ngIf="s.classOrBatch">{{ s.classOrBatch }}</span>
                  </div>
                </div>
              </div>

              <!-- Right Actions: Quick Punch + Status Toggles -->
              <div class="rollcall-controls-wrap">
                <!-- 1-Click Biometric Punch Button -->
                <button
                  type="button"
                  mat-stroked-button
                  color="accent"
                  class="quick-punch-btn"
                  *ngIf="hostelAttendanceMode !== 'Manual'"
                  (click)="quickPunchResident(s)"
                  matTooltip="Test 1-click Biometric Punch for {{ s.studentName }}"
                >
                  <mat-icon>fingerprint</mat-icon> Punch Now
                </button>

                <!-- Status Buttons -->
                <div class="rollcall-status-toggles" [class.locked]="hostelAttendanceMode === 'Biometric'">
                  <button
                    type="button"
                    class="status-toggle-btn present"
                    [class.active]="s.status === 'Present'"
                    (click)="setStudentStatus(s, 'Present')"
                    [disabled]="hostelAttendanceMode === 'Biometric'"
                  >
                    Present
                  </button>
                  <button
                    type="button"
                    class="status-toggle-btn absent"
                    [class.active]="s.status === 'Absent'"
                    (click)="setStudentStatus(s, 'Absent')"
                    [disabled]="hostelAttendanceMode === 'Biometric'"
                  >
                    Absent
                  </button>
                  <button
                    type="button"
                    class="status-toggle-btn leave"
                    [class.active]="s.status === 'OnLeave'"
                    (click)="setStudentStatus(s, 'OnLeave')"
                    [disabled]="hostelAttendanceMode === 'Biometric'"
                  >
                    On Leave
                  </button>
                  <button
                    type="button"
                    class="status-toggle-btn gatepass"
                    [class.active]="s.status === 'GatePass'"
                    (click)="setStudentStatus(s, 'GatePass')"
                    [disabled]="hostelAttendanceMode === 'Biometric'"
                  >
                    Gate Pass
                  </button>
                  <button
                    type="button"
                    class="status-toggle-btn late"
                    [class.active]="s.status === 'Late'"
                    (click)="setStudentStatus(s, 'Late')"
                    [disabled]="hostelAttendanceMode === 'Biometric'"
                  >
                    Late
                  </button>
                </div>
              </div>
            </div>
          </div>

          <ng-template #noRollCallStudents>
            <div class="empty-state-box">
              <mat-icon class="empty-icon">nightlight</mat-icon>
              <h3>No Resident Students in this Hostel</h3>
              <p>Allocate vacant beds to students in this hostel block to take roll call or track biometric gate attendance.</p>
            </div>
          </ng-template>
        </div>
      </mat-card>

      <!-- ================= MODALS ================= -->

      <!-- Add Hostel Modal -->
      <div class="modal-backdrop" *ngIf="showAddHostelModal">
        <div class="modal-dialog-card">
          <div class="modal-header">
            <h3>Add New Hostel Block</h3>
            <button mat-icon-button (click)="showAddHostelModal = false"><mat-icon>close</mat-icon></button>
          </div>
          <form [formGroup]="hostelForm" (ngSubmit)="submitAddHostel()">
            <div class="modal-body-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Hostel Block Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Ramanujan Boys Hostel (Block C)" />
              </mat-form-field>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Hostel Type</mat-label>
                  <mat-select formControlName="hostelType">
                    <mat-option value="Boys">Boys Hostel</mat-option>
                    <mat-option value="Girls">Girls Hostel</mat-option>
                    <mat-option value="Staff">Staff / Faculty Quarters</mat-option>
                    <mat-option value="Co-ed">Co-ed</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Total Floors</mat-label>
                  <input matInput type="number" formControlName="totalFloors" min="1" max="20" />
                </mat-form-field>
              </div>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Warden Name</mat-label>
                  <input matInput formControlName="wardenName" placeholder="e.g. Ramesh Chandra" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Warden Contact Phone</mat-label>
                  <input matInput formControlName="wardenPhone" placeholder="10-digit mobile" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Campus Location / Address</mat-label>
                <input matInput formControlName="address" placeholder="e.g. North Wing, Behind Main Academic Block" />
              </mat-form-field>
            </div>
            <div class="modal-footer">
              <button mat-button type="button" (click)="showAddHostelModal = false">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="hostelForm.invalid">
                Save Hostel Block
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Add Room Modal -->
      <div class="modal-backdrop" *ngIf="showAddRoomModal">
        <div class="modal-dialog-card">
          <div class="modal-header">
            <h3>Add New Room &amp; Beds</h3>
            <button mat-icon-button (click)="showAddRoomModal = false"><mat-icon>close</mat-icon></button>
          </div>
          <form [formGroup]="roomForm" (ngSubmit)="submitAddRoom()">
            <div class="modal-body-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Hostel Block</mat-label>
                <mat-select formControlName="hostelId">
                  <mat-option *ngFor="let h of hostels" [value]="h.id">{{ h.name }}</mat-option>
                </mat-select>
              </mat-form-field>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Room Number</mat-label>
                  <input matInput formControlName="roomNumber" placeholder="e.g. 101, 204, G-02" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Floor</mat-label>
                  <mat-select formControlName="floor">
                    <mat-option value="Ground">Ground Floor</mat-option>
                    <mat-option value="1st Floor">1st Floor</mat-option>
                    <mat-option value="2nd Floor">2nd Floor</mat-option>
                    <mat-option value="3rd Floor">3rd Floor</mat-option>
                    <mat-option value="4th Floor">4th Floor</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Room Sharing Type</mat-label>
                  <mat-select formControlName="roomType" (selectionChange)="onRoomTypeChange($event.value)">
                    <mat-option value="Single">Single Room (1 Bed)</mat-option>
                    <mat-option value="Double">Double Sharing (2 Beds)</mat-option>
                    <mat-option value="Triple">Triple Sharing (3 Beds)</mat-option>
                    <mat-option value="4-Bed">4-Bed Sharing (4 Beds)</mat-option>
                    <mat-option value="Dormitory">Dormitory (6 Beds)</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Capacity (Beds)</mat-label>
                  <input matInput type="number" formControlName="capacity" min="1" max="12" />
                </mat-form-field>
              </div>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Monthly Rent / Bed (₹)</mat-label>
                  <input matInput type="number" formControlName="monthlyRent" placeholder="e.g. 8500" />
                </mat-form-field>

                <div class="checkbox-pair">
                  <mat-checkbox formControlName="hasAC">Air Conditioned (AC)</mat-checkbox>
                  <mat-checkbox formControlName="hasAttachedBath">Attached Bath</mat-checkbox>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Amenities (Optional)</mat-label>
                <input matInput formControlName="amenities" placeholder="e.g. Study Table, Wardrobe, Balcony, Geyser" />
              </mat-form-field>

              <div class="auto-beds-hint">
                <mat-checkbox formControlName="autoGenerateBeds" color="primary">
                  Auto-create individual Bed Codes (e.g. {{ roomForm.value.roomNumber || '101' }}-A, {{ roomForm.value.roomNumber || '101' }}-B)
                </mat-checkbox>
              </div>
            </div>
            <div class="modal-footer">
              <button mat-button type="button" (click)="showAddRoomModal = false">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="roomForm.invalid">
                Create Room &amp; Beds
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Quick Bed Allocate Modal -->
      <div class="modal-backdrop" *ngIf="showAllocateModal">
        <div class="modal-dialog-card allocate-dialog">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <h3>Allocate Bed: {{ allocatingBed?.bedCode }}</h3>
              <span class="modal-sub">Room {{ allocatingRoom?.roomNumber }} &bull; {{ allocatingRoom?.hostelName }} (Floor {{ allocatingRoom?.floor }})</span>
            </div>
            <button mat-icon-button (click)="closeAllocateModal()"><mat-icon>close</mat-icon></button>
          </div>
          <form [formGroup]="allocateForm" (ngSubmit)="submitAllocateBed()">
            <div class="modal-body-form">

              <!-- Filter Pills: All / School Only (Class-wise) / Coaching Only (Batch-wise) -->
              <div class="student-search-header">
                <div class="filter-pills-container">
                  <span class="filter-title"><mat-icon>filter_list</mat-icon> Student Source:</span>
                  <div class="filter-pills-list">
                    <button type="button" class="type-pill" [class.active]="studentFilterType === 'all'" (click)="setStudentFilterType('all')">
                      <mat-icon>groups</mat-icon> All Students
                    </button>
                    <button type="button" class="type-pill pill-school" [class.active]="studentFilterType === 'school'" (click)="setStudentFilterType('school')">
                      <mat-icon>school</mat-icon> School Only (Class-wise)
                    </button>
                    <button type="button" class="type-pill pill-coaching" [class.active]="studentFilterType === 'coaching'" (click)="setStudentFilterType('coaching')">
                      <mat-icon>menu_book</mat-icon> Coaching Only (Batch-wise)
                    </button>
                  </div>
                </div>

                <!-- Server-Side Live Search Input -->
                <div class="search-input-wrapper">
                  <mat-form-field appearance="outline" class="full-width search-input-field">
                    <mat-label>Search Student (Name, Roll No, Admission No, Phone, Class, Batch)</mat-label>
                    <input matInput [(ngModel)]="studentSearchQuery" [ngModelOptions]="{standalone: true}" (ngModelChange)="onStudentSearchChanged($event)" placeholder="Type name, roll, class (e.g. 10th A) or coaching batch..." autocomplete="off" />
                    <mat-icon matPrefix>search</mat-icon>
                    <button mat-icon-button matSuffix *ngIf="studentSearchQuery" (click)="clearStudentSearch()" type="button" matTooltip="Clear search">
                      <mat-icon>close</mat-icon>
                    </button>
                  </mat-form-field>
                  <!-- Smooth server-side searching progress bar loader -->
                  <mat-progress-bar *ngIf="isSearchingStudents" mode="indeterminate" class="search-loader-bar"></mat-progress-bar>
                </div>
              </div>

              <!-- Group-Wise Student Selection Dropdown -->
              <mat-form-field appearance="outline" class="full-width student-dropdown-field">
                <mat-label>Select Student to Allocate Bed</mat-label>
                <mat-select formControlName="studentId" (selectionChange)="onStudentSelected($event.value)" panelClass="student-search-dropdown-panel">
                  <mat-select-trigger *ngIf="selectedStudentDetails">
                    <div class="selected-trigger-display">
                      <strong>{{ selectedStudentDetails.studentName }}</strong>
                      <span class="trigger-roll" *ngIf="selectedStudentDetails.rollNumber"> &bull; Roll: {{ selectedStudentDetails.rollNumber }}</span>
                      <span class="trigger-badge" [class.school]="selectedStudentDetails.isSchoolStudent" [class.coaching]="selectedStudentDetails.isCoachingStudent && !selectedStudentDetails.isSchoolStudent">
                        {{ selectedStudentDetails.groupName }}
                      </span>
                    </div>
                  </mat-select-trigger>

                  <mat-optgroup *ngFor="let grp of studentGroups" [label]="grp.groupName">
                    <mat-option *ngFor="let s of grp.students" [value]="s.id" [disabled]="s.isAlreadyAllocated" class="student-opt-item">
                      <div class="opt-student-container">
                        <div class="opt-left">
                          <span class="opt-name">{{ s.studentName }}</span>
                          <span class="opt-roll" *ngIf="s.rollNumber">Roll: {{ s.rollNumber }}</span>
                          <span class="opt-phone" *ngIf="s.parentPhone">&bull; 📞 {{ s.parentPhone }}</span>
                        </div>
                        <div class="opt-right-badges">
                          <span class="badge-school" *ngIf="s.isSchoolStudent">
                            <mat-icon>school</mat-icon> {{ s.className || 'Class' }}{{ s.sectionName ? ' (' + s.sectionName + ')' : '' }}
                          </span>
                          <span class="badge-coaching" *ngIf="s.isCoachingStudent">
                            <mat-icon>menu_book</mat-icon> {{ s.batchName || 'Coaching' }}
                          </span>
                          <span class="badge-gender" *ngIf="s.gender">{{ s.gender }}</span>
                          <span class="badge-allocated" *ngIf="s.isAlreadyAllocated">
                            <mat-icon>block</mat-icon> Occupied ({{ s.currentBedInfo }})
                          </span>
                        </div>
                      </div>
                    </mat-option>
                  </mat-optgroup>

                  <mat-option *ngIf="!isSearchingStudents && studentGroups.length === 0" disabled>
                    No students found for this search/filter.
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <!-- Selected Student Overview Summary Card -->
              <div class="selected-student-card" *ngIf="selectedStudentDetails">
                <div class="student-avatar-circle">
                  <mat-icon>person</mat-icon>
                </div>
                <div class="student-meta-details">
                  <div class="meta-row-top">
                    <span class="student-fullname">{{ selectedStudentDetails.studentName }}</span>
                    <span class="student-tag tag-school" *ngIf="selectedStudentDetails.isSchoolStudent">
                      School: {{ selectedStudentDetails.className || 'Class' }}{{ selectedStudentDetails.sectionName ? ' - ' + selectedStudentDetails.sectionName : '' }}
                    </span>
                    <span class="student-tag tag-coaching" *ngIf="selectedStudentDetails.isCoachingStudent">
                      Coaching: {{ selectedStudentDetails.batchName || 'Coaching Batch' }}
                    </span>
                    <span class="student-tag tag-gender" *ngIf="selectedStudentDetails.gender">{{ selectedStudentDetails.gender }}</span>
                  </div>
                  <div class="meta-row-bottom">
                    <span *ngIf="selectedStudentDetails.rollNumber"><strong>Roll No:</strong> {{ selectedStudentDetails.rollNumber }}</span>
                    <span *ngIf="selectedStudentDetails.parentName"><strong>Parent:</strong> {{ selectedStudentDetails.parentName }}</span>
                    <span *ngIf="selectedStudentDetails.parentPhone"><strong>WhatsApp/Phone:</strong> {{ selectedStudentDetails.parentPhone }}</span>
                  </div>
                </div>
              </div>

              <!-- Rent & Mess Plan in a clean, spacious 2-column row -->
              <div class="form-row-allocate">
                <mat-form-field appearance="outline" class="rent-field">
                  <mat-label>Monthly Bed Rent (₹)</mat-label>
                  <input matInput type="number" formControlName="monthlyRent" />
                  <span matPrefix class="currency-prefix">₹&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline" class="mess-plan-field">
                  <mat-label>Mess / Food Facility Plan</mat-label>
                  <mat-select formControlName="messPlan" panelClass="mess-plan-dropdown-panel">
                    <mat-option value="Full Board">
                      <div class="plan-item-layout">
                        <strong>Full Board</strong>
                        <span class="plan-sub">All Meals Included (Breakfast + Lunch + Evening Snacks + Dinner)</span>
                      </div>
                    </mat-option>
                    <mat-option value="Lunch & Dinner">
                      <div class="plan-item-layout">
                        <strong>Lunch &amp; Dinner</strong>
                        <span class="plan-sub">Mid-day School/Coaching Meal + Night Dinner</span>
                      </div>
                    </mat-option>
                    <mat-option value="Breakfast & Dinner">
                      <div class="plan-item-layout">
                        <strong>Breakfast &amp; Dinner</strong>
                        <span class="plan-sub">Morning Breakfast + Night Dinner</span>
                      </div>
                    </mat-option>
                    <mat-option value="None">
                      <div class="plan-item-layout">
                        <strong>Self / No Mess Plan</strong>
                        <span class="plan-sub">Room accommodation only &bull; Mess fee excluded</span>
                      </div>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Allocation Remarks (Optional)</mat-label>
                <input matInput formControlName="remarks" placeholder="e.g. Mattress issued, special dietary preferences, guardian authorized" />
              </mat-form-field>
            </div>

            <div class="modal-footer">
              <button mat-button type="button" (click)="closeAllocateModal()">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="allocateForm.invalid || loading">
                <mat-icon>check_circle</mat-icon> Confirm Bed Allocation
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Issue Gate Pass Modal -->
      <div class="modal-backdrop" *ngIf="showGatePassModal">
        <div class="modal-dialog-card gatepass-dialog">
          <div class="modal-header">
            <h3>Issue Hostel Gate Pass / Outing</h3>
            <button mat-icon-button (click)="showGatePassModal = false"><mat-icon>close</mat-icon></button>
          </div>
          <form [formGroup]="gatePassForm" (ngSubmit)="submitGatePass()">
            <div class="modal-body-form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Resident Student</mat-label>
                <mat-select formControlName="studentId">
                  <mat-option *ngFor="let s of residentStudentsList" [value]="s.studentId">
                    {{ s.studentName }} (Rm {{ s.roomNumber }} - {{ s.bedCode }})
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Departure Date &amp; Time (IST)</mat-label>
                  <input matInput type="datetime-local" formControlName="outDate" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Expected Return Date &amp; Time (IST)</mat-label>
                  <input matInput type="datetime-local" formControlName="expectedReturnDate" />
                </mat-form-field>
              </div>

              <div class="form-row-2">
                <mat-form-field appearance="outline">
                  <mat-label>Purpose of Leaving Campus</mat-label>
                  <mat-select formControlName="purpose" panelClass="purpose-dropdown-panel">
                    <mat-option value="Home Visit (Weekend)">Home Visit (Weekend)</mat-option>
                    <mat-option value="Medical Emergency / Doctor">Medical Emergency / Doctor</mat-option>
                    <mat-option value="Coaching Extra Class / Test">Coaching Extra Class / Test</mat-option>
                    <mat-option value="Local Market / Supplies (2 hrs)">Local Market / Supplies (2 hrs)</mat-option>
                    <mat-option value="Other">Other</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Parent Contact Phone</mat-label>
                  <input matInput formControlName="parentContactNumber" placeholder="Parent phone e.g. 9876543210" />
                </mat-form-field>
              </div>

              <div class="consent-check-wrap">
                <mat-checkbox formControlName="parentConsentGiven" color="primary">
                  Parent / Guardian telephonic / WhatsApp permission verified
                </mat-checkbox>
              </div>
            </div>
            <div class="modal-footer">
              <button mat-button type="button" (click)="showGatePassModal = false">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="gatePassForm.invalid">
                Print &amp; Issue Gate Pass
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Biometric Turnstile Simulator Modal -->
      <div class="modal-backdrop" *ngIf="showBiometricSimulatorModal">
        <div class="modal-dialog-card">
          <div class="modal-header">
            <h3><mat-icon color="accent" style="vertical-align:middle;margin-right:6px;">fingerprint</mat-icon> Simulate Biometric Turnstile Punch</h3>
            <button mat-icon-button (click)="showBiometricSimulatorModal = false"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body-form">
            <p class="auto-beds-hint">
              This simulator triggers a live biometric turnstile hardware event (turnstile gate / facial scanner / fingerprint) to instantly record automated attendance.
            </p>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Resident Student</mat-label>
              <mat-select [(ngModel)]="simulatingStudentId">
                <mat-option *ngFor="let s of rollCallStudents" [value]="s.studentId">
                  {{ s.studentName }} (Rm {{ s.roomNumber }} - Bed {{ s.bedCode }})
                  <span *ngIf="s.biometricUserId"> [Bio: {{ s.biometricUserId }}]</span>
                </mat-option>
              </mat-select>
            </mat-form-field>

            <div class="form-row-2">
              <mat-form-field appearance="outline">
                <mat-label>Turnstile Device ID</mat-label>
                <input matInput [(ngModel)]="simulatingDeviceId" placeholder="e.g. GATE-TURNSTILE-01" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Punch Timestamp</mat-label>
                <input matInput [(ngModel)]="simulatingPunchTime" placeholder="Now (Real-time)" />
              </mat-form-field>
            </div>
          </div>
          <div class="modal-footer">
            <button mat-button type="button" (click)="showBiometricSimulatorModal = false">Cancel</button>
            <button mat-raised-button color="accent" type="button" (click)="executeBiometricPunch()" [disabled]="!simulatingStudentId">
              <mat-icon>fingerprint</mat-icon> Trigger Punch
            </button>
          </div>
        </div>
      </div>

      <!-- Resident Biometric IDs Mapping Modal -->
      <div class="modal-backdrop" *ngIf="showBiometricMappingModal">
        <div class="modal-dialog-card wide-dialog">
          <div class="modal-header">
            <h3><mat-icon color="primary" style="vertical-align:middle;margin-right:6px;">badge</mat-icon> Hostel Residents Biometric ID Mappings</h3>
            <button mat-icon-button (click)="showBiometricMappingModal = false"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body-form mappings-table-container">
            <p class="auto-beds-hint">
              Enroll and configure device Biometric User IDs (e.g. machine punch user ID, card number, or facial template ID) for each hostel resident.
            </p>

            <table class="custom-data-table mapping-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Block &amp; Bed</th>
                  <th>Biometric User ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of biometricMappingsList">
                  <td>
                    <strong>{{ m.studentName }}</strong>
                    <small *ngIf="m.rollNumber" style="display:block;color:#64748b;">Roll: {{ m.rollNumber }}</small>
                  </td>
                  <td>{{ m.hostelName }} - Rm {{ m.roomNumber }} ({{ m.bedCode }})</td>
                  <td>
                    <input
                      type="text"
                      class="bio-input"
                      [(ngModel)]="m.biometricUserId"
                      placeholder="e.g. BIO-101"
                    />
                  </td>
                  <td>
                    <button
                      mat-flat-button
                      color="primary"
                      class="sm-btn"
                      (click)="saveBiometricMapping(m)"
                      [disabled]="!m.biometricUserId"
                    >
                      Save ID
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button mat-button type="button" (click)="showBiometricMappingModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hostel-page-wrapper {
      padding: 24px;
      background: #f8fafc;
      min-height: calc(100vh - 64px);

      @media (max-width: 768px) {
        padding: 12px;
      }
    }

    .page-header-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 18px 24px;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      margin-bottom: 20px;

      @media (max-width: 960px) {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
        padding: 16px;

        .header-right-actions {
          width: 100%;
          flex-wrap: wrap;
          gap: 8px;

          .action-btn {
            flex: 1 1 auto;
            justify-content: center;
          }
        }
      }

      .header-left {
        display: flex;
        align-items: center;
        gap: 16px;

        @media (max-width: 600px) {
          gap: 12px;
          .header-icon-badge {
            width: 44px;
            height: 44px;
            min-width: 44px;
            mat-icon { font-size: 24px; width: 24px; height: 24px; }
          }
        }

        .header-icon-badge {
          width: 50px;
          height: 50px;
          min-width: 50px;
          border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);

          mat-icon { font-size: 28px; width: 28px; height: 28px; }
        }

        .header-title-box {
          .title-row {
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;

            h1 {
              font-size: 21px;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.3px;

              @media (max-width: 600px) {
                font-size: 18px;
              }
            }

            .live-pill {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              background: #ecfdf5;
              color: #059669;
              border: 1px solid #a7f3d0;
              font-size: 11px;
              font-weight: 700;
              padding: 2px 9px;
              border-radius: 20px;
              letter-spacing: 0.2px;

              .pulse-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                background: #10b981;
                box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
                display: inline-block;
              }
            }

            .optional-tag {
              background: #eef2ff;
              color: #4f46e5;
              border: 1px solid #c7d2fe;
              font-size: 11px;
              font-weight: 600;
              padding: 2px 9px;
              border-radius: 20px;
            }
          }

          .subtitle {
            font-size: 13px;
            color: #64748b;
            margin: 4px 0 0;
            line-height: 1.4;

            strong {
              color: #334155;
              font-weight: 600;
            }
          }
        }
      }

      .header-right-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .action-btn {
          border-radius: 10px;
          font-weight: 600;
          font-size: 13px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: none;
          transition: all 0.2s ease;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            margin-right: 2px;
          }
        }
      }
    }

    .kpi-grid-container {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 22px;

      @media (max-width: 1199px) and (min-width: 768px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      @media (max-width: 767px) and (min-width: 480px) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      @media (max-width: 479px) {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .kpi-card {
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        border-top: 3px solid transparent;
        transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06) !important;
        }

        &.hostel-kpi {
          border-top-color: #4f46e5;
          .kpi-icon-wrap { background: #eef2ff; color: #4f46e5; }
        }
        &.room-kpi {
          border-top-color: #0284c7;
          .kpi-icon-wrap { background: #e0f2fe; color: #0284c7; }
        }
        &.capacity-kpi {
          border-top-color: #7c3aed;
          .kpi-icon-wrap { background: #f3e8ff; color: #7c3aed; }
        }
        &.occupied-kpi {
          border-top-color: #d97706;
          .kpi-icon-wrap { background: #fef3c7; color: #d97706; }
        }
        &.vacant-kpi {
          border-top-color: #059669;
          .kpi-icon-wrap { background: #d1fae5; color: #059669; }
        }
        &.gatepass-kpi {
          border-top-color: #ec4899;
          .kpi-icon-wrap { background: #fce7f3; color: #ec4899; }
        }

        .kpi-inner {
          padding: 12px 14px !important;
          display: flex;
          align-items: center;
          gap: 10px;

          .kpi-icon-wrap {
            width: 38px;
            height: 38px;
            min-width: 38px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;

            mat-icon {
              font-size: 20px;
              width: 20px;
              height: 20px;
            }
          }

          .kpi-content {
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-width: 0;

            .kpi-num {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              line-height: 1.15;
              display: flex;
              align-items: center;
              gap: 4px;

              .pct-badge {
                font-size: 10px;
                font-weight: 700;
                background: #fef3c7;
                color: #b45309;
                padding: 1px 5px;
                border-radius: 10px;
                line-height: 1.2;
              }
            }

            .kpi-label {
              font-size: 11px;
              color: #64748b;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              margin-top: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
      }
    }

    .main-content-card {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;

      .tabs-nav-bar {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
        overflow-x: auto;
        white-space: nowrap;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;

        .nav-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 20px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-size: 14px;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
          flex-shrink: 0;

          mat-icon { font-size: 20px; width: 20px; height: 20px; }

          &:hover { color: #4f46e5; background: #eef2ff; }
          &.active {
            color: #4f46e5;
            border-bottom-color: #4f46e5;
            background: white;
          }
        }
      }
    }

    .tab-pane {
      padding: 24px;
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      overflow-x: hidden;

      @media (max-width: 768px) {
        padding: 14px 10px;
      }
    }

    /* MATRIX TAB */
    .matrix-filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }

      .filter-group {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;

        @media (max-width: 768px) {
          width: 100%;
          flex-direction: column;
          align-items: stretch;

          .dense-field, .hostel-filter-field, .bed-status-filter-field {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        .dense-field { min-width: 220px; }
        .hostel-filter-field { min-width: 440px; }
        .bed-status-filter-field { min-width: 220px; }
      }

      .legend-bar {
        display: flex;
        gap: 16px;
        font-size: 13px;
        font-weight: 500;

        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;

          .dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            &.available { background: #10b981; }
            &.occupied { background: #4f46e5; }
          }
        }
      }
    }

    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }

    .room-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      transition: transform 0.2s, box-shadow 0.2s;
      width: 100%;
      box-sizing: border-box;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
      }

      @media (max-width: 480px) {
        padding: 12px;

        .room-card-header {
          flex-wrap: wrap;
          gap: 6px;
        }

        .room-meta {
          flex-wrap: wrap;
          gap: 4px;
        }

        .bed-card .available-body {
          flex-wrap: wrap;
          gap: 6px;
        }

        .bed-card .occupied-body {
          flex-wrap: wrap;
          gap: 6px;
        }
      }

      .room-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;

        .room-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #0f172a;
          mat-icon { color: #4f46e5; }
          .room-num { font-size: 16px; font-weight: 700; }
        }

        .room-tags {
          display: flex;
          gap: 4px;

          .tag-pill {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            text-transform: uppercase;

            &.ac { background: #dbeafe; color: #1d4ed8; }
            &.nonac { background: #f1f5f9; color: #475569; }
            &.type { background: #fef3c7; color: #b45309; }
            &.floor { background: #f3e8ff; color: #7e22ce; }
          }
        }
      }

      .room-meta {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #64748b;
        margin-bottom: 14px;
        padding-bottom: 10px;
        border-bottom: 1px dashed #e2e8f0;
        .room-rent-label { font-weight: 600; color: #0f172a; }
      }

      .beds-list {
        display: flex;
        flex-direction: column;
        gap: 10px;

        .bed-card {
          border-radius: 8px;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;

          &.available-bed {
            background: #f0fdf4;
            border-color: #bbf7d0;
          }

          &.occupied-bed {
            background: #faf5ff;
            border-color: #e9d5ff;
          }

          .bed-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;

            .bed-code-badge {
              display: flex;
              align-items: center;
              gap: 4px;
              font-weight: 700;
              font-size: 13px;
              color: #0f172a;
              mat-icon { font-size: 16px; width: 16px; height: 16px; }
            }

            .bed-status-pill {
              font-size: 10px;
              font-weight: 700;
              padding: 2px 8px;
              border-radius: 12px;
              background: #ede9fe;
              color: #6b21a8;

              &.vacant {
                background: #dcfce7;
                color: #15803d;
              }
            }
          }

          .available-body {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .rent-tag { font-size: 12px; font-weight: 600; color: #15803d; }
            .allocate-btn {
              font-size: 11px;
              height: 28px;
              line-height: 28px;
              padding: 0 10px;
              border-radius: 6px;
              mat-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 2px; }
            }
          }

          .occupied-body {
            display: flex;
            justify-content: space-between;
            align-items: center;

            .student-avatar-row {
              display: flex;
              align-items: center;
              gap: 8px;

              .student-avatar {
                width: 32px;
                height: 32px;
                border-radius: 50%;
                overflow: hidden;
                background: #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                img { width: 100%; height: 100%; object-fit: cover; }
                mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
              }

              .student-meta {
                display: flex;
                flex-direction: column;
                .student-name-text { font-size: 13px; color: #0f172a; line-height: 1.2; }
                .roll-text, .stream-text { font-size: 11px; color: #64748b; }
              }
            }

            .bed-actions {
              display: flex;
              gap: 2px;
              mat-icon { font-size: 18px; width: 18px; height: 18px; }
            }
          }
        }
      }
    }

    /* HOSTELS MASTER TAB */
    .hostels-master-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      width: 100%;
      box-sizing: border-box;

      @media (max-width: 600px) {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .hostel-block-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        width: 100%;
        box-sizing: border-box;

        @media (max-width: 500px) {
          padding: 14px;
        }

        .block-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 10px;

          @media (max-width: 480px) {
            flex-direction: column;
            align-items: flex-start;

            .block-quick-stats {
              align-items: flex-start !important;
              flex-direction: row !important;
              flex-wrap: wrap;
            }
          }

          .block-title-box {
            display: flex;
            align-items: center;
            gap: 12px;

            .block-icon {
              width: 44px;
              height: 44px;
              border-radius: 10px;
              display: flex;
              align-items: center;
              justify-content: center;
              &.boys { background: #eff6ff; color: #2563eb; }
              &.girls { background: #fdf2f8; color: #db2777; }
              &.staff { background: #f0fdf4; color: #16a34a; }
            }

            h3 { margin: 0 0 2px; font-size: 16px; font-weight: 700; color: #0f172a; }
            .type-pill { font-size: 11px; font-weight: 600; color: #64748b; }
          }

          .block-quick-stats {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;

            .stat-bubble {
              font-size: 11px;
              background: #f1f5f9;
              padding: 2px 8px;
              border-radius: 10px;
              color: #475569;
            }
          }
        }

        .block-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 13px;
          color: #475569;
          margin-bottom: 16px;

          .detail-row {
            display: flex;
            align-items: center;
            gap: 8px;
            mat-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
          }
        }

        .block-card-footer {
          border-top: 1px solid #f1f5f9;
          padding-top: 12px;
          display: flex;
          justify-content: flex-end;

          @media (max-width: 500px) {
            button {
              width: 100%;
              justify-content: center;
            }
          }
        }
      }
    }

    /* TOOLBARS & DATA TABLES */
    .residents-toolbar, .gatepass-toolbar {
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;

      .search-field {
        width: 320px;
        max-width: 100%;
      }

      @media (max-width: 600px) {
        flex-direction: column;
        align-items: stretch;

        .search-field {
          width: 100% !important;
          min-width: 0 !important;
        }

        button {
          width: 100%;
          justify-content: center;
        }
      }
    }

    .residents-table-wrap, .gatepasses-table-wrap, .allocations-table-wrap {
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      box-sizing: border-box;
      display: block;
      margin-bottom: 16px;
    }

    /* GATE PASSES SMART GRID STYLES */
    .gp-control-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      padding: 16px 20px 0 20px;
      margin-bottom: 16px;
      overflow: hidden;

      .gp-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 14px;

        .gp-heading-area {
          display: flex;
          align-items: center;
          gap: 12px;

          .gp-icon-badge {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;

            mat-icon { font-size: 24px; width: 24px; height: 24px; }
          }

          .gp-title {
            margin: 0;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }

          .gp-subtitle {
            margin: 2px 0 0 0;
            font-size: 12px;
            color: #64748b;
          }
        }

        .issue-gp-btn {
          font-weight: 600;
          border-radius: 8px;
          height: 38px;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
      }

      .gp-filter-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
        padding-bottom: 12px;

        .gp-status-pills {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .gp-pill {
            border: 1px solid #cbd5e1;
            background: #f8fafc;
            color: #334155;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s ease;

            .pill-count {
              background: #e2e8f0;
              color: #1e293b;
              font-size: 11px;
              padding: 1px 7px;
              border-radius: 10px;
              font-weight: 700;
            }

            .live-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #0284c7;
              display: inline-block;
              box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25);
            }

            .pill-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            &:hover {
              background: #f1f5f9;
              border-color: #94a3b8;
            }

            &.active {
              background: #1e293b;
              color: white;
              border-color: #1e293b;

              .pill-count {
                background: rgba(255, 255, 255, 0.25);
                color: white;
              }
            }

            &.pill-out.active {
              background: #0369a1;
              border-color: #0369a1;
            }

            &.pill-returned.active {
              background: #15803d;
              border-color: #15803d;
            }

            &.pill-overdue {
              .warn-alert {
                background: #ef4444;
                color: white;
              }

              &.active {
                background: #b91c1c;
                border-color: #b91c1c;
              }
            }
          }
        }

        .gp-search-wrapper {
          flex: 1;
          min-width: 260px;
          max-width: 400px;

          .gp-search-field {
            width: 100%;
            margin-bottom: -16px;
          }

          @media (max-width: 768px) {
            max-width: 100%;
            width: 100%;
          }
        }
      }

      .gp-table-loader {
        height: 3px;
        margin: 0 -20px;
      }
    }

    .gp-table-card {
      background: white;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      margin-bottom: 20px;

      .table-responsive-container {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      .gp-mat-table {
        width: 100%;
        min-width: 960px;
        background: white;

        th.mat-header-cell {
          background: #f8fafc;
          color: #334155;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          white-space: nowrap;
        }

        td.mat-cell {
          padding: 12px 14px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #1e293b;
        }

        .gp-table-row {
          transition: background-color 0.15s ease;

          &:hover {
            background-color: #f8fafc;
          }

          &.row-overdue {
            background-color: #fff1f2;
          }
        }

        .pass-chip-box {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .pass-number-text {
            font-family: monospace;
            font-weight: 700;
            color: #0f172a;
            font-size: 12.5px;
          }

          .pass-date-sub {
            color: #64748b;
            font-size: 11px;
          }
        }

        .student-profile-cell {
          display: flex;
          align-items: center;
          gap: 10px;

          .student-avatar-badge {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
            color: #3730a3;
            font-weight: 700;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }

          .student-details-box {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .student-name-bold {
              font-weight: 600;
              color: #0f172a;
              font-size: 13.5px;
            }

            .student-sub-info {
              display: flex;
              align-items: center;
              gap: 6px;

              .student-class-chip {
                background: #f1f5f9;
                color: #475569;
                font-size: 11px;
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 600;
              }

              .student-roll-chip {
                color: #64748b;
                font-size: 11px;
              }
            }
          }
        }

        .room-bed-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12.5px;
          color: #1e40af;
          background: #eff6ff;
          padding: 4px 10px;
          border-radius: 6px;
          font-weight: 500;

          .bed-icon { font-size: 15px; width: 15px; height: 15px; }
        }

        .date-display-box {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .date-main {
            font-weight: 600;
            color: #1e293b;
            font-size: 12.5px;
          }

          .time-sub {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 11.5px;
            color: #64748b;
            line-height: 1;

            .clock-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
              line-height: 14px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              vertical-align: middle;
              overflow: visible;
            }
          }

          .overdue-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 10.5px;
            font-weight: 700;
            color: #b91c1c;
            background: #fee2e2;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 2px;
            width: fit-content;

            mat-icon { font-size: 12px; width: 12px; height: 12px; }
          }
        }

        .purpose-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-width: 180px;

          .purpose-title {
            font-weight: 500;
            color: #334155;
            font-size: 12.5px;
          }

          .remarks-sub {
            color: #94a3b8;
            font-size: 11px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }

        .consent-cell-box {
          display: flex;
          flex-direction: column;
          gap: 2px;

          .verified-tag {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 11px;
            font-weight: 700;
            color: #15803d;
            background: #dcfce7;
            padding: 2px 7px;
            border-radius: 10px;
            width: fit-content;

            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }

          .parent-phone-link {
            font-size: 11.5px;
            color: #2563eb;
            text-decoration: none;
            font-weight: 500;

            &:hover {
              text-decoration: underline;
            }
          }
        }

        .consent-self-tag {
          font-size: 11px;
          color: #64748b;
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .smart-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          white-space: nowrap;

          &.status-out {
            background: #e0f2fe;
            color: #0369a1;

            .pulse-indicator {
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: #0284c7;
              animation: pulse 1.5s infinite;
            }
          }

          &.status-completed {
            background: #dcfce7;
            color: #15803d;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          &.status-overdue {
            background: #fee2e2;
            color: #b91c1c;

            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }
        }

        .smart-return-btn {
          height: 32px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 6px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 4px;

          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .returned-safe-info {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          color: #166534;
          background: #dcfce7;
          border: 1px solid #bbf7d0;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          white-space: nowrap;

          .safe-icon {
            font-size: 15px;
            width: 15px;
            height: 15px;
            line-height: 15px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            overflow: visible;
            color: #16a34a;
          }
        }

        .empty-table-cell {
          padding: 32px 16px;
          text-align: center;
        }
      }

      .gp-paginator {
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
      }
    }

    .custom-data-table {
      width: 100%;
      min-width: 840px;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #f8fafc;
        text-align: left;
        padding: 12px 14px;
        color: #475569;
        font-weight: 600;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;

        &.action-cell {
          text-align: center;
          width: 140px;
          min-width: 140px;
        }
      }

      td {
        padding: 12px 14px;
        border-bottom: 1px solid #f1f5f9;
        color: #1e293b;
        vertical-align: middle;

        &.action-cell {
          text-align: center;
          white-space: nowrap;
          width: 140px;
          min-width: 140px;
        }
      }

      .student-cell {
        display: flex;
        flex-direction: column;
        .name { font-weight: 600; color: #0f172a; }
        .class-info { color: #64748b; font-size: 11px; }
      }

      .bed-pill {
        background: #eff6ff;
        color: #1d4ed8;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 6px;
      }

      .mess-pill {
        background: #fef3c7;
        color: #92400e;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 6px;
        &.included { background: #ecfdf5; color: #065f46; }
      }

      .status-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        background: #f1f5f9;
        color: #475569;
        &.active, &.approved { background: #dcfce7; color: #15803d; }
        &.pending { background: #fef3c7; color: #b45309; }
        &.completed { background: #e0e7ff; color: #4338ca; }
      }

      .consent-tag {
        font-size: 11px;
        color: #64748b;
        &.yes { color: #15803d; font-weight: 600; }
      }

      .sm-btn {
        height: 34px !important;
        min-height: 34px !important;
        max-height: 34px !important;
        padding: 0 14px !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 6px !important;
        white-space: nowrap !important;
        box-shadow: none !important;
        line-height: normal !important;

        &.return-btn {
          background: #4f46e5 !important;
          color: #ffffff !important;
          box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25) !important;

          &:hover {
            background: #4338ca !important;
            box-shadow: 0 4px 10px rgba(79, 70, 229, 0.35) !important;
          }
        }

        mat-icon {
          font-size: 17px !important;
          width: 17px !important;
          height: 17px !important;
          line-height: 17px !important;
          margin: 0 !important;
        }

        ::ng-deep .mdc-button__label {
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          line-height: 1 !important;
        }
      }

      .returned-text {
        font-size: 11px;
        color: #15803d;
        font-weight: 600;
        background: #dcfce7;
        padding: 4px 10px;
        border-radius: 12px;
        display: inline-flex;
        align-items: center;
      }
    }

    /* ROLL CALL TAB */
    .rc-progress-bar {
      height: 3px;
      margin-bottom: 14px;
      border-radius: 2px;
    }

    .rollcall-header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 16px;

      @media (max-width: 768px) {
        flex-direction: column;
        align-items: stretch;
      }

      .rollcall-inputs {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;

        @media (max-width: 768px) {
          width: 100%;
          flex-direction: column;
          align-items: stretch;
          gap: 10px;

          .dense-field, .hostel-select-field, .date-field, .mode-field {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        .dense-field { min-width: 180px; }
        .hostel-select-field { min-width: 320px; }
        .date-field { min-width: 160px; }
        .mode-field { min-width: 280px; }
      }

      .rollcall-actions-right {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;

        @media (max-width: 768px) {
          width: 100%;
          .action-btn {
            flex: 1 1 auto;
            justify-content: center;
          }
        }

        .action-btn {
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
        }
      }
    }

    .mode-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }

      &.hybrid { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
      &.manual { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
      &.biometric { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    }

    .biometric-locked-alert {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      color: #1e40af;
      padding: 12px 18px;
      border-radius: 10px;
      margin-bottom: 16px;
      font-size: 13px;
      mat-icon { font-size: 22px; width: 22px; height: 22px; color: #2563eb; }
    }

    .rollcall-list {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .rollcall-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 12px 18px;
        transition: all 0.2s;

        &:hover { border-color: #cbd5e1; box-shadow: 0 2px 8px rgba(0,0,0,0.03); }

        .student-info-col {
          display: flex;
          align-items: center;
          gap: 14px;

          .avatar-small {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: #e2e8f0;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            img { width: 100%; height: 100%; object-fit: cover; }
          }

          .student-details-wrap {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .name-row {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;

              .name { font-size: 15px; font-weight: 700; color: #0f172a; }
              .roll-tag { font-size: 12px; color: #64748b; font-weight: 500; }

              .bio-id-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 12px;
                background: #f1f5f9;
                color: #334155;
                cursor: pointer;
                transition: all 0.2s;
                mat-icon { font-size: 13px; width: 13px; height: 13px; }

                &:hover { background: #e2e8f0; }
                &.unmapped { background: #fef2f2; color: #dc2626; border: 1px dashed #f87171; }
              }

              .source-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 12px;
                mat-icon { font-size: 13px; width: 13px; height: 13px; }

                &.bio { background: #dcfce7; color: #15803d; }
                &.manual { background: #f3e8ff; color: #7e22ce; }
              }

              .gatepass-pill {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-size: 11px;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 12px;
                background: #fff7ed;
                color: #ea580c;
                border: 1px solid #ffedd5;
                mat-icon { font-size: 13px; width: 13px; height: 13px; }
              }
            }

            .sub-line {
              display: flex;
              gap: 12px;
              font-size: 12px;
              color: #64748b;
              flex-wrap: wrap;
              .room-tag { font-weight: 600; color: #4f46e5; }
              .phone-tag { color: #475569; }
              .class-tag { background: #f8fafc; padding: 1px 6px; border-radius: 4px; }
            }
          }
        }

        @media (max-width: 768px) {
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;

          .student-info-col {
            width: 100%;
          }

          .rollcall-controls-wrap {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            gap: 10px;

            .quick-punch-btn {
              width: 100%;
              justify-content: center;
            }

            .rollcall-status-toggles {
              width: 100%;
              overflow-x: auto;
              display: flex;

              .status-toggle-btn {
                flex: 1;
                text-align: center;
                padding: 6px 4px;
                font-size: 11px;
              }
            }
          }
        }

        .rollcall-controls-wrap {
          display: flex;
          align-items: center;
          gap: 12px;

          .quick-punch-btn {
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          }

          .rollcall-status-toggles {
            display: flex;
            gap: 6px;

            &.locked {
              opacity: 0.6;
              pointer-events: none;
            }

            .status-toggle-btn {
              border: 1px solid #cbd5e1;
              background: white;
              padding: 6px 14px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;

              &.present.active { background: #10b981; color: white; border-color: #10b981; }
              &.absent.active { background: #ef4444; color: white; border-color: #ef4444; }
              &.leave.active { background: #f59e0b; color: white; border-color: #f59e0b; }
              &.gatepass.active { background: #ea580c; color: white; border-color: #ea580c; }
              &.late.active { background: #6366f1; color: white; border-color: #6366f1; }
            }
          }
        }
      }
    }

    .wide-dialog {
      max-width: 720px !important;
    }

    .mappings-table-container {
      max-height: 60vh;
      overflow-y: auto;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      width: 100%;
      box-sizing: border-box;
    }

    .mapping-table {
      .bio-input {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        width: 140px;
        &:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.2); }
      }
    }

    /* MODALS */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;

      .modal-dialog-card {
        background: white;
        border-radius: 14px;
        width: 100%;
        max-width: 540px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        overflow: hidden;

        &.allocate-dialog {
          max-width: 760px;
          width: 95vw;
        }

        &.gatepass-dialog {
          max-width: 680px;
          width: 95vw;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          h3 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }

          .modal-title-wrap {
            display: flex;
            flex-direction: column;
            gap: 2px;

            h3 {
              margin: 0;
              font-size: 18px;
              font-weight: 700;
              color: #0f172a;
            }

            .modal-sub {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
            }
          }
        }

        .modal-body-form {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 75vh;
          overflow-y: auto;

          .full-width { width: 100%; }
          .form-row-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;

            @media (max-width: 540px) {
              grid-template-columns: 1fr;
            }
          }

          .form-row-allocate {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 14px;

            @media (max-width: 600px) {
              grid-template-columns: 1fr;
            }

            .currency-prefix {
              font-weight: 700;
              color: #64748b;
            }
          }

          .student-search-header {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 14px 4px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;

            .filter-pills-container {
              display: flex;
              align-items: center;
              gap: 10px;
              flex-wrap: wrap;

              .filter-title {
                font-size: 12px;
                font-weight: 700;
                color: #475569;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                text-transform: uppercase;
                letter-spacing: 0.4px;

                mat-icon { font-size: 16px; width: 16px; height: 16px; }
              }

              .filter-pills-list {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;

                .type-pill {
                  border: 1px solid #cbd5e1;
                  background: white;
                  color: #334155;
                  padding: 5px 12px;
                  border-radius: 20px;
                  font-size: 12px;
                  font-weight: 600;
                  cursor: pointer;
                  display: inline-flex;
                  align-items: center;
                  gap: 5px;
                  transition: all 0.2s ease;

                  mat-icon { font-size: 15px; width: 15px; height: 15px; }

                  &:hover {
                    border-color: #94a3b8;
                    background: #f1f5f9;
                  }

                  &.active {
                    background: #1e293b;
                    color: white;
                    border-color: #1e293b;
                    box-shadow: 0 2px 4px rgba(30, 41, 59, 0.2);
                  }

                  &.pill-school.active {
                    background: #3730a3;
                    border-color: #3730a3;
                  }

                  &.pill-coaching.active {
                    background: #1e40af;
                    border-color: #1e40af;
                  }
                }
              }
            }

            .search-input-wrapper {
              position: relative;
              width: 100%;

              .search-input-field {
                margin-bottom: -10px;
              }

              .search-loader-bar {
                height: 3px;
                border-radius: 2px;
                margin-top: -12px;
                margin-bottom: 8px;
              }
            }
          }

          .student-dropdown-field {
            margin-top: 4px;

            .selected-trigger-display {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 13.5px;

              .trigger-roll {
                color: #64748b;
                font-size: 12px;
              }

              .trigger-badge {
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 10px;
                background: #e2e8f0;
                color: #334155;
                font-weight: 600;

                &.school {
                  background: #e0e7ff;
                  color: #3730a3;
                }

                &.coaching {
                  background: #dbeafe;
                  color: #1e40af;
                }
              }
            }
          }

          .selected-student-card {
            display: flex;
            align-items: center;
            gap: 12px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 10px 14px;

            .student-avatar-circle {
              width: 38px;
              height: 38px;
              border-radius: 50%;
              background: #dcfce7;
              color: #15803d;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;

              mat-icon { font-size: 22px; width: 22px; height: 22px; }
            }

            .student-meta-details {
              display: flex;
              flex-direction: column;
              gap: 3px;
              flex: 1;

              .meta-row-top {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;

                .student-fullname {
                  font-size: 14px;
                  font-weight: 700;
                  color: #0f172a;
                }

                .student-tag {
                  font-size: 11px;
                  font-weight: 600;
                  padding: 1px 7px;
                  border-radius: 4px;

                  &.tag-school { background: #e0e7ff; color: #3730a3; }
                  &.tag-coaching { background: #dbeafe; color: #1e40af; }
                  &.tag-gender { background: #e2e8f0; color: #475569; }
                }
              }

              .meta-row-bottom {
                display: flex;
                align-items: center;
                gap: 14px;
                font-size: 12px;
                color: #475569;
                flex-wrap: wrap;
              }
            }
          }

          .checkbox-pair {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 6px;
          }

          .auto-beds-hint {
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px dashed #cbd5e1;
          }

          .consent-check-wrap {
            padding: 8px 0;
          }
        }

        .modal-footer {
          padding: 14px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 10px;

          @media (max-width: 540px) {
            padding: 12px 16px;
            flex-wrap: wrap;
            button { flex: 1; }
          }
        }
      }
    }

    .empty-state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;

      .empty-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #94a3b8;
        margin-bottom: 12px;
      }

      h3 { margin: 0 0 6px; font-size: 18px; font-weight: 700; color: #1e293b; }
      p { margin: 0 0 16px; font-size: 14px; color: #64748b; max-width: 400px; }
    }
  `]
})
export class HostelManagementComponent implements OnInit {
  activeTab: 'matrix' | 'hostels' | 'residents' | 'gatepass' | 'rollcall' = 'matrix';
  loading = false;

  overview: HostelOverviewSummaryDto | null = null;
  hostels: HostelDto[] = [];
  matrixRooms: any[] = [];
  filteredMatrixRooms: any[] = [];
  allocations: HostelAllocationDto[] = [];
  gatePasses: HostelGatePassDto[] = [];
  // Gate Passes Server-Side State & Sorting/Filtering/Pagination
  gatePassSearchQuery = '';
  gatePassStatusFilter = 'all'; // 'all' | 'out' | 'returned' | 'overdue'
  gatePassSortBy = 'outDate';
  gatePassSortOrder: 'asc' | 'desc' = 'desc';
  gatePassPageIndex = 1;
  gatePassPageSize = 10;
  gatePassTotalCount = 0;
  gatePassTotalPages = 1;
  gatePassActiveOutCount = 0;
  gatePassCompletedCount = 0;
  gatePassOverdueCount = 0;
  isGatePassLoading = false;
  isRollCallLoading = false;
  displayedGatePassColumns: string[] = [
    'passNumber',
    'student',
    'roomAndBed',
    'outDate',
    'expectedReturn',
    'purpose',
    'parentConsent',
    'status',
    'action'
  ];
  private gatePassSearch$ = new Subject<string>();
  allStudentsList: any[] = [];
  residentStudentsList: any[] = [];

  // Matrix filters
  selectedHostelFilter = '';
  selectedBedStatusFilter = 'all';

  // Residents search
  residentSearch = '';

  // Server-side Student Search & Categorized Filtering for Bed Allocation
  studentSearchQuery = '';
  studentFilterType: 'all' | 'school' | 'coaching' = 'all';
  isSearchingStudents = false;
  searchedStudents: HostelStudentSearchResultDto[] = [];
  studentGroups: { groupName: string; students: HostelStudentSearchResultDto[] }[] = [];
  selectedStudentDetails: HostelStudentSearchResultDto | null = null;
  private studentSearch$ = new Subject<string>();

  // Roll Call & Biometric Attendance
  rollCallHostelId = '';
  rollCallDate = new Date().toISOString().substring(0, 10);
  rollCallStudents: any[] = [];
  hostelAttendanceMode: 'Manual' | 'Biometric' | 'Both' = 'Both';

  // Biometric Simulator & Mapping Modals
  showBiometricSimulatorModal = false;
  showBiometricMappingModal = false;
  simulatingStudentId = '';
  simulatingDeviceId = 'GATE-TURNSTILE-01';
  simulatingPunchTime = '';
  biometricMappingsList: any[] = [];

  // Modals
  showAddHostelModal = false;
  showAddRoomModal = false;
  showAllocateModal = false;
  showGatePassModal = false;

  allocatingRoom: any = null;
  allocatingBed: any = null;

  // Forms
  hostelForm: FormGroup;
  roomForm: FormGroup;
  allocateForm: FormGroup;
  gatePassForm: FormGroup;

  constructor(
    private hostelService: HostelService,
    private coachingService: CoachingService,
    private fb: FormBuilder,
    private dialog: MatDialog
  ) {
    this.hostelForm = this.fb.group({
      name: ['', Validators.required],
      hostelType: ['Boys', Validators.required],
      totalFloors: [1, [Validators.required, Validators.min(1)]],
      wardenName: [''],
      wardenPhone: [''],
      address: ['']
    });

    this.roomForm = this.fb.group({
      hostelId: ['', Validators.required],
      roomNumber: ['', Validators.required],
      floor: ['Ground', Validators.required],
      roomType: ['Double', Validators.required],
      capacity: [2, [Validators.required, Validators.min(1)]],
      monthlyRent: [8500, Validators.required],
      hasAC: [true],
      hasAttachedBath: [true],
      amenities: ['Air Conditioner, Attached Bath, Study Table'],
      autoGenerateBeds: [true]
    });

    this.allocateForm = this.fb.group({
      studentId: ['', Validators.required],
      monthlyRent: [8500, Validators.required],
      messPlan: ['Full Board', Validators.required],
      remarks: ['']
    });

    this.gatePassForm = this.fb.group({
      studentId: ['', Validators.required],
      outDate: ['', Validators.required],
      expectedReturnDate: ['', Validators.required],
      purpose: ['Home Visit (Weekend)', Validators.required],
      parentContactNumber: [''],
      parentConsentGiven: [true]
    });
  }

  showSuccessDialog(title: string, message: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title,
        message,
        type: 'success',
        isAlert: true,
        confirmText: 'OK'
      }
    });
  }

  showErrorDialog(title: string, message: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title,
        message,
        type: 'danger',
        isAlert: true,
        confirmText: 'OK'
      }
    });
  }

  showConfirmDialog(
    title: string,
    message: string,
    confirmText: string = 'Confirm',
    type: 'danger' | 'warning' | 'info' = 'danger'
  ): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title,
        message,
        confirmText,
        cancelText: 'Cancel',
        type,
        isAlert: false
      }
    });
    return dialogRef.afterClosed();
  }

  ngOnInit(): void {
    this.loadAllData();
    this.studentSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((query) => {
        this.fetchStudentsForAllocation(query);
      });

    this.gatePassSearch$
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.gatePassPageIndex = 1;
        this.loadGatePasses();
      });
  }

  loadOverview(): void {
    this.hostelService.getOverview().subscribe({
      next: (ov) => (this.overview = ov),
      error: () => {}
    });
  }

  loadAllData(): void {
    this.loading = true;
    this.loadOverview();

    this.hostelService.getHostels().subscribe({
      next: (h) => {
        this.hostels = h || [];
        if (this.hostels.length > 0 && !this.rollCallHostelId) {
          this.rollCallHostelId = this.hostels[0].id;
        }
      }
    });

    this.loadBedMatrix();
    this.loadAllocations();
    this.loadGatePasses();
    this.loadAttendanceSettings();

    // Load students for allocation dropdown
    this.coachingService.getStudents().subscribe({
      next: (s) => (this.allStudentsList = s || [])
    });
  }

  setTab(tab: 'matrix' | 'hostels' | 'residents' | 'gatepass' | 'rollcall'): void {
    this.activeTab = tab;
    if (tab === 'matrix') this.loadBedMatrix();
    if (tab === 'residents') this.loadAllocations();
    if (tab === 'gatepass') this.loadGatePasses();
    if (tab === 'rollcall') this.loadRollCall();
  }

  loadBedMatrix(): void {
    this.loading = true;
    this.hostelService.getBedMatrix(this.selectedHostelFilter || undefined).subscribe({
      next: (rooms) => {
        this.matrixRooms = rooms || [];
        this.applyMatrixFilter();
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  applyMatrixFilter(): void {
    if (this.selectedBedStatusFilter === 'all') {
      this.filteredMatrixRooms = this.matrixRooms;
    } else {
      this.filteredMatrixRooms = this.matrixRooms
        .map((r) => ({
          ...r,
          beds: r.beds.filter((b: any) => b.status === this.selectedBedStatusFilter)
        }))
        .filter((r) => r.beds.length > 0);
    }
  }

  loadAllocations(): void {
    this.hostelService.getAllocations().subscribe({
      next: (allocs) => {
        this.allocations = allocs || [];
        this.residentStudentsList = this.allocations.filter((a) => a.status === 'Active');
      }
    });
  }

  get filteredAllocations(): HostelAllocationDto[] {
    if (!this.residentSearch) return this.allocations;
    const term = this.residentSearch.toLowerCase();
    return this.allocations.filter(
      (a) =>
        a.studentName.toLowerCase().includes(term) ||
        (a.rollNumber && a.rollNumber.toLowerCase().includes(term)) ||
        a.roomNumber.toLowerCase().includes(term) ||
        a.bedCode.toLowerCase().includes(term)
    );
  }

  isGatePassOverdue(g: HostelGatePassDto): boolean {
    if (g.wardenApprovalStatus === 'Completed' || g.actualReturnDate) return false;
    if (!g.expectedReturnDate) return false;
    return new Date(g.expectedReturnDate).getTime() < new Date().getTime();
  }

  onGatePassSearchChanged(q: string): void {
    this.gatePassSearch$.next(q);
  }

  clearGatePassSearch(): void {
    this.gatePassSearchQuery = '';
    this.gatePassPageIndex = 1;
    this.loadGatePasses();
  }

  setGatePassStatusFilter(status: string): void {
    this.gatePassStatusFilter = status;
    this.gatePassPageIndex = 1;
    this.loadGatePasses();
  }

  onGatePassSortChange(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      this.gatePassSortBy = 'outDate';
      this.gatePassSortOrder = 'desc';
    } else {
      this.gatePassSortBy = sort.active;
      this.gatePassSortOrder = sort.direction as 'asc' | 'desc';
    }
    this.gatePassPageIndex = 1;
    this.loadGatePasses();
  }

  onGatePassPageChange(event: PageEvent): void {
    this.gatePassPageIndex = event.pageIndex + 1;
    this.gatePassPageSize = event.pageSize;
    this.loadGatePasses();
  }

  loadGatePasses(): void {
    this.isGatePassLoading = true;
    this.hostelService
      .getGatePasses({
        search: this.gatePassSearchQuery,
        status: this.gatePassStatusFilter,
        sortBy: this.gatePassSortBy,
        sortOrder: this.gatePassSortOrder,
        pageIndex: this.gatePassPageIndex,
        pageSize: this.gatePassPageSize
      })
      .subscribe({
        next: (res) => {
          this.isGatePassLoading = false;
          this.gatePasses = res?.items || [];
          this.gatePassTotalCount = res?.totalCount || 0;
          this.gatePassTotalPages = res?.totalPages || 1;
          this.gatePassActiveOutCount = res?.activeOutCount || 0;
          this.gatePassCompletedCount = res?.completedCount || 0;
          this.gatePassOverdueCount = res?.overdueCount || 0;
        },
        error: () => {
          this.isGatePassLoading = false;
          this.gatePasses = [];
          this.gatePassTotalCount = 0;
        }
      });
  }

  loadAttendanceSettings(): void {
    this.hostelService.getAttendanceSettings().subscribe({
      next: (res) => {
        if (res && res.hostelMode) {
          this.hostelAttendanceMode = res.hostelMode;
        }
      },
      error: () => {}
    });
  }

  onHostelModeChange(mode: 'Manual' | 'Biometric' | 'Both'): void {
    this.hostelAttendanceMode = mode;
    this.hostelService.updateAttendanceSettings(mode).subscribe({
      next: () => {
        this.loadRollCall();
      },
      error: (err) => {
        this.showErrorDialog('Update Failed', err?.error?.message || 'Failed to update attendance mode.');
      }
    });
  }

  setStudentStatus(s: any, status: string): void {
    if (this.hostelAttendanceMode === 'Biometric') return;
    s.status = status;
  }

  loadRollCall(): void {
    if (!this.rollCallHostelId) return;
    this.isRollCallLoading = true;
    this.hostelService.getRollCall(this.rollCallHostelId, this.rollCallDate).subscribe({
      next: (students) => {
        this.rollCallStudents = students || [];
        this.isRollCallLoading = false;
        this.loading = false;
      },
      error: () => {
        this.isRollCallLoading = false;
        this.loading = false;
      }
    });
  }

  markAllPresent(): void {
    if (this.hostelAttendanceMode === 'Biometric') return;
    this.rollCallStudents.forEach((s) => (s.status = 'Present'));
  }

  saveRollCall(): void {
    if (this.hostelAttendanceMode === 'Biometric') {
      this.showErrorDialog('Roll Call Locked', 'Manual roll call is disabled because Attendance Mode is set to Biometric Only.');
      return;
    }
    if (!this.rollCallHostelId || this.rollCallStudents.length === 0) return;
    this.loading = true;
    this.hostelService
      .saveBulkRollCall({
        hostelId: this.rollCallHostelId,
        attendanceDate: this.rollCallDate,
        rollCallShift: 'Night',
        items: this.rollCallStudents.map((s) => ({
          studentId: s.studentId,
          status: s.status,
          remarks: s.remarks
        }))
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.showSuccessDialog('Roll Call Saved', 'Night roll call attendance has been recorded successfully.');
          this.loadRollCall();
        },
        error: (err) => {
          this.loading = false;
          this.showErrorDialog('Save Failed', err?.error?.message || 'Failed to save roll call.');
        }
      });
  }

  openBiometricSimulator(): void {
    if (this.rollCallStudents.length > 0 && !this.simulatingStudentId) {
      this.simulatingStudentId = this.rollCallStudents[0].studentId;
    }
    this.simulatingPunchTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    this.showBiometricSimulatorModal = true;
  }

  quickPunchResident(student: any): void {
    this.simulatingStudentId = student.studentId;
    this.simulatingPunchTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    this.executeBiometricPunch();
  }

  executeBiometricPunch(): void {
    if (!this.simulatingStudentId) return;
    this.loading = true;
    this.hostelService
      .simulateBiometricPunch({
        studentId: this.simulatingStudentId,
        deviceId: this.simulatingDeviceId || 'GATE-TURNSTILE-01',
        shift: 'Night'
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.showBiometricSimulatorModal = false;
          this.showSuccessDialog('Biometric Punch Recorded', res?.message || 'Biometric punch recorded successfully!');
          this.loadRollCall();
        },
        error: (err) => {
          this.loading = false;
          this.showErrorDialog('Punch Simulation Failed', err?.error?.message || 'Failed to simulate biometric punch.');
        }
      });
  }

  openBiometricMappings(): void {
    this.loading = true;
    this.hostelService.getBiometricMappings().subscribe({
      next: (list) => {
        this.biometricMappingsList = list || [];
        this.showBiometricMappingModal = true;
        this.loading = false;
      },
      error: () => (this.loading = false)
    });
  }

  openQuickMapBio(student: any): void {
    this.openBiometricMappings();
  }

  saveBiometricMapping(item: any): void {
    if (!item.biometricUserId) return;
    this.hostelService.updateBiometricMapping(item.studentId, item.biometricUserId).subscribe({
      next: () => {
        this.showSuccessDialog('Biometric ID Saved', `Biometric ID saved for ${item.studentName}.`);
        this.loadRollCall();
      },
      error: (err) => this.showErrorDialog('Save Failed', err?.error?.message || 'Failed to save Biometric ID.')
    });
  }

  // Modals & Submissions
  openAddHostelModal(): void {
    this.hostelForm.reset({ hostelType: 'Boys', totalFloors: 1 });
    this.showAddHostelModal = true;
  }

  submitAddHostel(): void {
    if (this.hostelForm.invalid) return;
    this.loading = true;
    this.hostelService.createHostel(this.hostelForm.value).subscribe({
      next: () => {
        this.showAddHostelModal = false;
        this.loadAllData();
        this.showSuccessDialog('Hostel Created', 'Hostel block facility created successfully.');
      },
      error: (err) => {
        this.loading = false;
        this.showErrorDialog('Failed', err?.error?.message || 'Failed to create hostel.');
      }
    });
  }

  openAddRoomModal(): void {
    this.roomForm.reset({
      hostelId: this.hostels.length > 0 ? this.hostels[0].id : '',
      floor: 'Ground',
      roomType: 'Double',
      capacity: 2,
      monthlyRent: 8500,
      hasAC: true,
      hasAttachedBath: true,
      amenities: 'Air Conditioner, Attached Bath, Study Table',
      autoGenerateBeds: true
    });
    this.showAddRoomModal = true;
  }

  openAddRoomForHostel(hostel: HostelDto): void {
    this.openAddRoomModal();
    this.roomForm.patchValue({ hostelId: hostel.id });
  }

  onRoomTypeChange(type: string): void {
    const capacities: Record<string, number> = {
      Single: 1,
      Double: 2,
      Triple: 3,
      '4-Bed': 4,
      Dormitory: 6
    };
    if (capacities[type]) {
      this.roomForm.patchValue({ capacity: capacities[type] });
    }
  }

  submitAddRoom(): void {
    if (this.roomForm.invalid) return;
    this.loading = true;
    this.hostelService.createRoom(this.roomForm.value).subscribe({
      next: () => {
        this.showAddRoomModal = false;
        this.loadAllData();
        this.showSuccessDialog('Room Created', 'Room and configured beds added successfully.');
      },
      error: (err) => {
        this.loading = false;
        this.showErrorDialog('Failed', err?.error?.message || 'Failed to create room.');
      }
    });
  }

  openQuickAllocateModal(room: any, bed: any): void {
    this.allocatingRoom = room;
    this.allocatingBed = bed;
    this.studentSearchQuery = '';
    this.studentFilterType = 'all';
    this.selectedStudentDetails = null;
    this.allocateForm.reset({
      studentId: '',
      monthlyRent: bed.monthlyRent || room.monthlyRent,
      messPlan: 'Full Board',
      remarks: ''
    });
    this.showAllocateModal = true;
    this.fetchStudentsForAllocation('');
  }

  closeAllocateModal(): void {
    this.showAllocateModal = false;
    this.selectedStudentDetails = null;
    this.studentSearchQuery = '';
  }

  onStudentSearchChanged(query: string): void {
    this.studentSearch$.next(query);
  }

  clearStudentSearch(): void {
    this.studentSearchQuery = '';
    this.fetchStudentsForAllocation('');
  }

  setStudentFilterType(type: 'all' | 'school' | 'coaching'): void {
    this.studentFilterType = type;
    this.fetchStudentsForAllocation(this.studentSearchQuery);
  }

  fetchStudentsForAllocation(query?: string): void {
    this.isSearchingStudents = true;
    const q = query !== undefined ? query : this.studentSearchQuery;
    this.hostelService.searchStudents(q, this.studentFilterType).subscribe({
      next: (results) => {
        this.isSearchingStudents = false;
        this.processStudentSearchResults(results || []);
      },
      error: () => {
        this.isSearchingStudents = false;
        this.searchedStudents = [];
        this.studentGroups = [];
      }
    });
  }

  processStudentSearchResults(results: HostelStudentSearchResultDto[]): void {
    this.searchedStudents = results;
    const map = new Map<string, HostelStudentSearchResultDto[]>();
    for (const s of results) {
      const gName = s.groupName || (s.isSchoolStudent ? 'School' : s.isCoachingStudent ? 'Coaching' : 'General');
      if (!map.has(gName)) {
        map.set(gName, []);
      }
      map.get(gName)!.push(s);
    }
    this.studentGroups = Array.from(map.entries()).map(([groupName, students]) => ({
      groupName,
      students
    }));

    // If a student was already selected in the form, maintain their details
    const currentSelectedId = this.allocateForm.get('studentId')?.value;
    if (currentSelectedId) {
      this.selectedStudentDetails = this.searchedStudents.find((s) => s.id === currentSelectedId) || null;
    }
  }

  onStudentSelected(studentId: string): void {
    this.selectedStudentDetails = this.searchedStudents.find((s) => s.id === studentId) || null;
  }

  submitAllocateBed(): void {
    if (this.allocateForm.invalid || !this.allocatingBed) return;
    this.loading = true;
    this.hostelService
      .allocateBed({
        studentId: this.allocateForm.value.studentId,
        bedId: this.allocatingBed.bedId,
        monthlyRent: this.allocateForm.value.monthlyRent,
        isMessIncluded: this.allocateForm.value.messPlan !== 'None',
        messPlan: this.allocateForm.value.messPlan,
        remarks: this.allocateForm.value.remarks
      })
      .subscribe({
        next: () => {
          this.showAllocateModal = false;
          this.loadAllData();
          this.showSuccessDialog('Bed Allocated', 'Student bed allocated successfully.');
        },
        error: (err) => {
          this.loading = false;
          this.showErrorDialog('Allocation Failed', err.error?.message || 'Failed to allocate bed.');
        }
      });
  }

  vacateStudentBed(bed: any): void {
    const activeAlloc = this.allocations.find((a) => a.bedId === bed.bedId && a.status === 'Active');
    if (!activeAlloc) {
      this.showErrorDialog('Not Found', 'Active allocation record not found for this bed.');
      return;
    }
    this.showConfirmDialog(
      'Vacate Resident Bed',
      `Are you sure you want to vacate Bed ${bed.bedCode} for ${bed.studentName}?`,
      'Vacate Bed',
      'danger'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.performVacate(activeAlloc.id);
      }
    });
  }

  vacateAllocation(a: HostelAllocationDto): void {
    this.showConfirmDialog(
      'Vacate Student Bed',
      `Are you sure you want to vacate ${a.studentName} from Room ${a.roomNumber} (${a.bedCode})?`,
      'Vacate Bed',
      'danger'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.performVacate(a.id);
      }
    });
  }

  private performVacate(allocationId: string): void {
    this.loading = true;
    this.hostelService.vacateBed({ allocationId }).subscribe({
      next: () => {
        this.loadAllData();
        this.showSuccessDialog('Bed Vacated', 'Resident vacated and bed is now marked as Vacant.');
      },
      error: (err) => {
        this.loading = false;
        this.showErrorDialog('Vacate Failed', err?.error?.message || 'Failed to vacate bed.');
      }
    });
  }

  private formatLocalDateTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  openGatePassModal(): void {
    const now = new Date();
    const returnLater = new Date(now.getTime() + 6 * 3600 * 1000); // 6 hours default

    this.gatePassForm.reset({
      studentId: this.residentStudentsList.length > 0 ? this.residentStudentsList[0].studentId : '',
      outDate: this.formatLocalDateTime(now),
      expectedReturnDate: this.formatLocalDateTime(returnLater),
      purpose: 'Home Visit (Weekend)',
      parentConsentGiven: true
    });
    this.showGatePassModal = true;
  }

  openGatePassForStudent(bed: any): void {
    this.openGatePassModal();
    this.gatePassForm.patchValue({
      studentId: bed.studentId,
      parentContactNumber: bed.phone
    });
  }

  submitGatePass(): void {
    if (this.gatePassForm.invalid) return;
    this.loading = true;
    this.hostelService.createGatePass(this.gatePassForm.value).subscribe({
      next: () => {
        this.showGatePassModal = false;
        this.loadAllData();
        if (this.rollCallHostelId) {
          this.loadRollCall();
        }
        this.loading = false;
        this.showSuccessDialog('Gate Pass Issued', 'Gate pass issued successfully with parent consent verified.');
      },
      error: (err) => {
        this.loading = false;
        this.showErrorDialog('Issue Failed', err?.error?.message || 'Failed to issue gate pass.');
      }
    });
  }

  markGatePassReturned(g: HostelGatePassDto): void {
    this.showConfirmDialog(
      'Confirm Student Return',
      `Mark student ${g.studentName} as safely returned to the hostel?`,
      'Mark Returned',
      'info'
    ).subscribe((confirmed) => {
      if (confirmed) {
        this.loading = true;
        this.hostelService.updateGatePassStatus(g.id, 'Completed').subscribe({
          next: () => {
            this.loadGatePasses();
            this.loadOverview();
            this.loadBedMatrix();
            if (this.rollCallHostelId) {
              this.loadRollCall();
            }
            this.loading = false;
            this.showSuccessDialog('Return Recorded', `Student ${g.studentName} has been marked as safely returned.`);
          },
          error: (err) => {
            this.loading = false;
            this.showErrorDialog('Update Failed', err?.error?.message || 'Failed to update gate pass status.');
          }
        });
      }
    });
  }

  getPhotoUrl(path?: string): string {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${API_BASE}/${path.replace(/^\//, '')}`;
  }
}
