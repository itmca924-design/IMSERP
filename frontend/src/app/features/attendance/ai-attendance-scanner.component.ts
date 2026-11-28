import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { SchoolService } from '../../core/services/school.service';
import { BatchesService } from '../../core/services/batches.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import {
  AiAttendanceScannerService,
  AiAttendanceRosterItem,
  AiAttendanceSummary
} from '../../core/services/ai-attendance-scanner.service';

@Component({
  selector: 'app-ai-attendance-scanner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatBadgeModule
  ],
  template: `
    <div class="page-container">
      <!-- Top Executive Header Deck -->
      <mat-card class="executive-header-card">
        <div class="header-inner">
          <div class="title-cluster">
            <div class="icon-avatar">
              <mat-icon>camera_indoor</mat-icon>
            </div>
            <div>
              <div class="badge-row">
                <span class="ai-pill">
                  <mat-icon class="pulse-dot">lens</mat-icon>
                  AGENTIC AI BIOMETRIC ENGINE
                </span>
                <span class="live-status-pill" [class.online]="isCameraActive">
                  <mat-icon>{{ isCameraActive ? 'videocam' : 'videocam_off' }}</mat-icon>
                  {{ isCameraActive ? 'Camera Live' : 'Camera Standby' }}
                </span>
              </div>
              <h1 class="page-title">AI Camera & Face Attendance Scanner</h1>
              <p class="page-subtitle">
                Zero-hardware AI vision attendance kiosk for gatekeepers and smart classrooms. Instant 1-second punch with automated voice greeting and parent WhatsApp alerts.
              </p>
            </div>
          </div>

          <div class="quick-stats-summary" *ngIf="summary">
            <div class="stat-bubble">
              <span class="stat-num">{{ summary.totalStudents }}</span>
              <span class="stat-lbl">Total Roster</span>
            </div>
            <div class="stat-bubble present">
              <span class="stat-num">{{ summary.presentCount }}</span>
              <span class="stat-lbl">Present ({{ summary.attendancePercentage }}%)</span>
            </div>
            <div class="stat-bubble absent">
              <span class="stat-num">{{ summary.absentCount }}</span>
              <span class="stat-lbl">Absent</span>
            </div>
            <div class="stat-bubble late">
              <span class="stat-num">{{ summary.lateCount }}</span>
              <span class="stat-lbl">Late</span>
            </div>
            <div class="stat-bubble unmarked">
              <span class="stat-num">{{ summary.unmarkedCount }}</span>
              <span class="stat-lbl">Pending</span>
            </div>
          </div>
        </div>

        <mat-progress-bar *ngIf="isLoading" mode="indeterminate" class="header-loader"></mat-progress-bar>
      </mat-card>

      <!-- Reactive Filter & Scope Deck -->
      <mat-card class="filter-deck-card">
        <form [formGroup]="filterForm" class="filter-form-grid">
          <!-- Tri-Modal Division Scope (Dynamically driven by Tenant Licensed Modules) -->
          <div class="scope-toggle-group" *ngIf="authService.hasSchoolModule() || authService.hasCoachingModule()">
            <label class="scope-label">Operational Division:</label>
            <div class="scope-buttons">
              <button
                *ngIf="authService.hasSchoolModule() && authService.hasCoachingModule()"
                type="button"
                mat-button
                [class.active-scope]="filterForm.get('divisionScope')?.value === 'all'"
                (click)="setDivisionScope('all')"
              >
                <mat-icon>hub</mat-icon> All / Hybrid
              </button>
              <button
                *ngIf="authService.hasSchoolModule()"
                type="button"
                mat-button
                [class.active-scope]="filterForm.get('divisionScope')?.value === 'school'"
                (click)="setDivisionScope('school')"
              >
                <mat-icon>school</mat-icon> School
              </button>
              <button
                *ngIf="authService.hasCoachingModule()"
                type="button"
                mat-button
                [class.active-scope]="filterForm.get('divisionScope')?.value === 'coaching'"
                (click)="setDivisionScope('coaching')"
              >
                <mat-icon>menu_book</mat-icon> Coaching
              </button>
            </div>
          </div>

          <!-- Branch Filter -->
          <mat-form-field appearance="outline" class="density-compact" *ngIf="branches.length > 0">
            <mat-label>Campus / Branch</mat-label>
            <mat-select formControlName="branchId">
              <mat-option value="">All Campuses Consolidated</mat-option>
              <mat-option *ngFor="let b of branches" [value]="b.id">{{ b.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Class Filter -->
          <mat-form-field appearance="outline" class="density-compact">
            <mat-label>Academic Class (कक्षा)</mat-label>
            <mat-select formControlName="classId">
              <mat-option value="">All Classes (Gate Mode)</mat-option>
              <mat-option *ngFor="let c of classes" [value]="c.id">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Cascading Section (School) or Batch (Coaching) -->
          <mat-form-field
            appearance="outline"
            class="density-compact"
            *ngIf="filterForm.get('divisionScope')?.value !== 'coaching' && sections.length > 0"
          >
            <mat-label>Section</mat-label>
            <mat-select formControlName="sectionId">
              <mat-option value="">All Sections</mat-option>
              <mat-option *ngFor="let s of sections" [value]="s.id">{{ s.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field
            appearance="outline"
            class="density-compact"
            *ngIf="filterForm.get('divisionScope')?.value !== 'school' && filteredBatches.length > 0"
          >
            <mat-label>Coaching Batch</mat-label>
            <mat-select formControlName="batchId">
              <mat-option value="">All Batches</mat-option>
              <mat-option *ngFor="let b of filteredBatches" [value]="b.id">{{ b.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Attendance Date -->
          <mat-form-field appearance="outline" class="density-compact date-field">
            <mat-label>Date (IST)</mat-label>
            <input matInput type="date" formControlName="date" />
          </mat-form-field>

          <!-- Refresh Action -->
          <div class="filter-actions">
            <button mat-stroked-button color="primary" type="button" (click)="loadRoster()" [disabled]="isLoading">
              <mat-icon>refresh</mat-icon> Reload
            </button>
            <button mat-flat-button color="accent" type="button" (click)="markAllUnmarkedAsPresent()" [disabled]="isLoading || summary?.unmarkedCount === 0">
              <mat-icon>done_all</mat-icon> Mark All Present
            </button>
          </div>
        </form>
      </mat-card>

      <!-- Main Kiosk Layout: 2 Columns on Desktop -->
      <div class="scanner-main-layout">
        <!-- Left HUD Column: Live Camera Viewfinder & Punch Terminal -->
        <div class="hud-column">
          <mat-card class="hud-card">
            <div class="hud-header">
              <div class="hud-title-wrap">
                <mat-icon class="camera-lens-icon">photo_camera_front</mat-icon>
                <div>
                  <h2 class="hud-title">AI Camera Viewfinder</h2>
                  <span class="hud-subtitle">Face Target Reticle & Fast ID Scanner</span>
                </div>
              </div>
              <div class="hud-toggles">
                <mat-slide-toggle [(ngModel)]="autoVoiceGreeting" color="primary" matTooltip="Speak greeting upon student detection">
                  <mat-icon class="toggle-icon">record_voice_over</mat-icon> Voice
                </mat-slide-toggle>
                <mat-slide-toggle [(ngModel)]="autoWhatsAppAlert" color="accent" matTooltip="Send arrival alert to parent WhatsApp">
                  <mat-icon class="toggle-icon">send</mat-icon> WhatsApp
                </mat-slide-toggle>
              </div>
            </div>

            <!-- Viewfinder Area -->
            <div class="viewfinder-container">
              <video #videoElement class="camera-stream" autoplay playsinline muted [class.hidden]="!isCameraActive"></video>
              <canvas #snapshotCanvas class="hidden-canvas"></canvas>

              <!-- Standby Placeholder when camera is off -->
              <div class="camera-standby-view" *ngIf="!isCameraActive">
                <mat-icon class="standby-icon">videocam_off</mat-icon>
                <p class="standby-text">Camera stream is currently in standby mode</p>
                <button mat-flat-button color="primary" (click)="startCamera()">
                  <mat-icon>videocam</mat-icon> Start AI Camera
                </button>
              </div>

              <!-- HUD Laser & Bounding Box Overlay (Active when camera is on) -->
              <div class="hud-overlay" *ngIf="isCameraActive">
                <div class="hud-reticle">
                  <div class="corner top-left"></div>
                  <div class="corner top-right"></div>
                  <div class="corner bottom-left"></div>
                  <div class="corner bottom-right"></div>
                  <div class="hud-laser-line"></div>
                  <div class="hud-target-center">
                    <mat-icon>face</mat-icon>
                  </div>
                </div>

                <!-- Instant Punch Flash Card (when a student is recognized/punched) -->
                <div class="recognition-flash-card" *ngIf="lastPunchedStudent">
                  <div class="flash-avatar">
                    <img *ngIf="lastPunchedStudent.profilePhoto" [src]="lastPunchedStudent.profilePhoto" alt="Student" />
                    <mat-icon *ngIf="!lastPunchedStudent.profilePhoto">person</mat-icon>
                  </div>
                  <div class="flash-info">
                    <div class="flash-status-row">
                      <span class="flash-status-pill present">PRESENT</span>
                      <span class="flash-time">{{ lastPunchedStudent.checkInTime }} IST</span>
                    </div>
                    <div class="flash-name">{{ lastPunchedStudent.studentName }}</div>
                    <div class="flash-meta">
                      Roll: {{ lastPunchedStudent.rollNumber }} | {{ lastPunchedStudent.className || 'Campus' }}
                    </div>
                  </div>
                  <mat-icon class="check-success-icon">check_circle</mat-icon>
                </div>
              </div>
            </div>

            <!-- Camera Controls Bar -->
            <div class="camera-controls-bar">
              <button mat-stroked-button *ngIf="isCameraActive" (click)="switchCamera()" [disabled]="isLoading">
                <mat-icon>flip_camera_ios</mat-icon> Flip Camera
              </button>
              <button mat-stroked-button color="warn" *ngIf="isCameraActive" (click)="stopCamera()">
                <mat-icon>stop</mat-icon> Stop Camera
              </button>
              <button mat-flat-button color="primary" *ngIf="!isCameraActive" (click)="startCamera()">
                <mat-icon>play_arrow</mat-icon> Start Camera
              </button>
            </div>

            <!-- Fast Scan / Barcode / Roll Entry Input inside HUD -->
            <div class="fast-punch-terminal">
              <mat-form-field appearance="outline" class="fast-input-field">
                <mat-label>Scan Barcode / Roll / Admission No / Student Name</mat-label>
                <input
                  matInput
                  #fastScanInput
                  [(ngModel)]="fastScanTerm"
                  (keyup.enter)="executeFastPunch()"
                  placeholder="e.g. 104, ADM-2026-08, or Priya..."
                  autocomplete="off"
                />
                <button
                  mat-icon-button
                  matSuffix
                  color="primary"
                  (click)="executeFastPunch()"
                  matTooltip="Instant 1-Second Punch"
                >
                  <mat-icon>login</mat-icon>
                </button>
              </mat-form-field>
              <div class="fast-hints">
                <mat-icon>info</mat-icon>
                <span>Type Roll Number or scan ID card barcode and press <strong>Enter</strong> for instant 1-second biometric punch.</span>
              </div>
            </div>
          </mat-card>

          <!-- Recent Punch Stream Card -->
          <mat-card class="recent-stream-card" *ngIf="summary && summary.recentPunches.length > 0">
            <div class="stream-header">
              <mat-icon>history</mat-icon>
              <h3>Today's Recent Gate Punches (IST)</h3>
              <span class="stream-badge">{{ summary.recentPunches.length }}</span>
            </div>
            <div class="stream-list">
              <div class="stream-item" *ngFor="let p of summary.recentPunches">
                <div class="stream-avatar">
                  <img *ngIf="p.profilePhoto" [src]="p.profilePhoto" alt="avatar" />
                  <mat-icon *ngIf="!p.profilePhoto">person</mat-icon>
                </div>
                <div class="stream-details">
                  <div class="name-row">
                    <span class="p-name">{{ p.studentName }}</span>
                    <span class="p-time">{{ p.checkInTime }}</span>
                  </div>
                  <div class="p-meta">
                    Roll: {{ p.rollNumber }} | {{ p.className || 'General' }}
                    <span *ngIf="p.batchName"> ({{ p.batchName }})</span>
                  </div>
                </div>
                <span class="p-status-pill" [ngClass]="p.attendanceStatus.toLowerCase()">
                  {{ p.attendanceStatus }}
                </span>
              </div>
            </div>
          </mat-card>
        </div>

        <!-- Right Column: Interactive Class Roster & Action Grid -->
        <div class="roster-column">
          <mat-card class="roster-card">
            <!-- Roster Toolbar -->
            <div class="roster-toolbar">
              <div class="roster-title-wrap">
                <h2 class="roster-title">
                  Class Roster ({{ filteredRoster.length }} Students)
                </h2>
                <span class="roster-date-badge">{{ selectedDateStr }}</span>
              </div>

              <div class="roster-search-box">
                <mat-form-field appearance="outline" class="density-compact search-input">
                  <mat-icon matPrefix>search</mat-icon>
                  <input
                    matInput
                    [(ngModel)]="searchRosterTerm"
                    (input)="applyRosterFilter()"
                    placeholder="Search roster..."
                  />
                  <button
                    mat-icon-button
                    matSuffix
                    *ngIf="searchRosterTerm"
                    (click)="searchRosterTerm = ''; applyRosterFilter()"
                  >
                    <mat-icon>clear</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <!-- Status Filter Chips -->
            <div class="status-chips-bar">
              <button
                mat-button
                class="status-chip-btn"
                [class.selected]="rosterStatusFilter === 'all'"
                (click)="setStatusFilter('all')"
              >
                All ({{ roster.length }})
              </button>
              <button
                mat-button
                class="status-chip-btn present"
                [class.selected]="rosterStatusFilter === 'Present'"
                (click)="setStatusFilter('Present')"
              >
                Present ({{ summary?.presentCount || 0 }})
              </button>
              <button
                mat-button
                class="status-chip-btn unmarked"
                [class.selected]="rosterStatusFilter === 'Unmarked'"
                (click)="setStatusFilter('Unmarked')"
              >
                Pending ({{ summary?.unmarkedCount || 0 }})
              </button>
              <button
                mat-button
                class="status-chip-btn absent"
                [class.selected]="rosterStatusFilter === 'Absent'"
                (click)="setStatusFilter('Absent')"
              >
                Absent ({{ summary?.absentCount || 0 }})
              </button>
              <button
                mat-button
                class="status-chip-btn late"
                [class.selected]="rosterStatusFilter === 'Late'"
                (click)="setStatusFilter('Late')"
              >
                Late ({{ summary?.lateCount || 0 }})
              </button>
            </div>

            <!-- Empty State -->
            <div class="empty-roster-state" *ngIf="!isLoading && filteredRoster.length === 0">
              <mat-icon class="empty-icon">people_outline</mat-icon>
              <h3>No students found</h3>
              <p>Adjust class or batch filters above to populate the attendance roster.</p>
            </div>

            <!-- Responsive Table / Card Grid -->
            <div class="table-responsive" *ngIf="filteredRoster.length > 0">
              <table class="roster-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll / ID</th>
                    <th>Class / Batch</th>
                    <th>Status</th>
                    <th>Punch Time</th>
                    <th style="text-align: right;">Quick Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    *ngFor="let item of filteredRoster"
                    [class.just-punched-row]="lastPunchedStudent?.studentId === item.studentId"
                  >
                    <td>
                      <div class="student-cell">
                        <div class="student-avatar-wrapper" (click)="capturePhotoForStudent(item)" matTooltip="Click to capture new photo from camera">
                          <img *ngIf="item.profilePhoto" [src]="item.profilePhoto" alt="photo" />
                          <mat-icon *ngIf="!item.profilePhoto">person</mat-icon>
                          <div class="avatar-camera-overlay">
                            <mat-icon>camera_alt</mat-icon>
                          </div>
                        </div>
                        <div class="student-details">
                          <span class="student-name">{{ item.studentName }}</span>
                          <span class="parent-meta" *ngIf="item.parentName">
                            Parent: {{ item.parentName }}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div class="roll-cell">
                        <span class="primary-roll">{{ item.rollNumber || 'N/A' }}</span>
                        <span class="admission-num" *ngIf="item.admissionNumber">Adm: {{ item.admissionNumber }}</span>
                      </div>
                    </td>
                    <td>
                      <div class="class-cell">
                        <span class="class-name">{{ item.className || 'General' }}</span>
                        <span class="batch-badge" *ngIf="item.batchName">{{ item.batchName }}</span>
                        <span class="section-badge" *ngIf="item.sectionName">Sec {{ item.sectionName }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="status-badge" [ngClass]="item.attendanceStatus.toLowerCase()">
                        {{ item.attendanceStatus }}
                      </span>
                    </td>
                    <td>
                      <span class="punch-time-text" *ngIf="item.checkInTime">
                        {{ item.checkInTime }}
                      </span>
                      <span class="unmarked-dash" *ngIf="!item.checkInTime">—</span>
                    </td>
                    <td style="text-align: right;">
                      <div class="action-buttons-group">
                        <button
                          mat-icon-button
                          class="action-btn present-btn"
                          (click)="punchStudent(item, 'Present')"
                          matTooltip="Mark Present"
                          [disabled]="isLoading"
                        >
                          <mat-icon>check</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          class="action-btn late-btn"
                          (click)="punchStudent(item, 'Late')"
                          matTooltip="Mark Late"
                          [disabled]="isLoading"
                        >
                          <mat-icon>schedule</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          class="action-btn absent-btn"
                          (click)="punchStudent(item, 'Absent')"
                          matTooltip="Mark Absent"
                          [disabled]="isLoading"
                        >
                          <mat-icon>close</mat-icon>
                        </button>
                        <button
                          mat-icon-button
                          class="action-btn snap-btn"
                          (click)="capturePhotoForStudent(item)"
                          matTooltip="Capture Photo from Camera"
                          [disabled]="!isCameraActive"
                        >
                          <mat-icon>photo_camera</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </mat-card>
        </div>
      </div>
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

    /* Executive Header */
    .executive-header-card {
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 12px -2px rgba(37,99,235,0.08);
    }
    .header-inner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }
    .title-cluster {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      max-width: 650px;
    }
    .icon-avatar {
      background: #2563eb;
      color: #ffffff;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(37,99,235,0.25);
    }
    .icon-avatar mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .badge-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }
    .ai-pill {
      background: #1e40af;
      color: #ffffff;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pulse-dot {
      font-size: 8px;
      width: 8px;
      height: 8px;
      color: #60a5fa;
      animation: pulse 1.5s infinite;
    }
    .live-status-pill {
      background: #f1f5f9;
      color: #64748b;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .live-status-pill.online {
      background: #dcfce7;
      color: #15803d;
      font-weight: 700;
    }
    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: #1e3a8a;
      margin: 0 0 4px;
    }
    .page-subtitle {
      font-size: 13px;
      color: #3b82f6;
      margin: 0;
      line-height: 1.4;
    }
    .quick-stats-summary {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .stat-bubble {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 10px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 80px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .stat-bubble.present {
      border-color: #86efac;
      background: #f0fdf4;
    }
    .stat-bubble.present .stat-num { color: #16a34a; }
    .stat-bubble.absent {
      border-color: #fca5a5;
      background: #fef2f2;
    }
    .stat-bubble.absent .stat-num { color: #dc2626; }
    .stat-bubble.late {
      border-color: #fde047;
      background: #fefce8;
    }
    .stat-bubble.late .stat-num { color: #ca8a04; }
    .stat-bubble.unmarked {
      border-color: #cbd5e1;
      background: #f8fafc;
    }
    .stat-bubble .stat-num {
      font-size: 20px;
      font-weight: 800;
      color: #1e293b;
    }
    .stat-bubble .stat-lbl {
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
    }
    .header-loader {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
    }

    /* Filter Deck */
    .filter-deck-card {
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    .filter-form-grid {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }
    .scope-toggle-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .scope-label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
    }
    .scope-buttons {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 2px;
    }
    .scope-buttons button {
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      min-width: 90px;
    }
    .scope-buttons button.active-scope {
      background: #2563eb;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(37,99,235,0.3);
    }
    .density-compact {
      max-width: 200px;
    }
    .density-compact.date-field {
      max-width: 160px;
    }
    .filter-actions {
      display: flex;
      gap: 8px;
      margin-left: auto;
    }

    /* Scanner Main Layout: 2 Columns */
    .scanner-main-layout {
      display: grid;
      grid-template-columns: 460px 1fr;
      gap: 20px;
    }
    @media (max-width: 1024px) {
      .scanner-main-layout {
        grid-template-columns: 1fr;
      }
    }

    /* HUD Column */
    .hud-column {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .hud-card {
      border-radius: 16px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .hud-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .hud-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .camera-lens-icon {
      color: #2563eb;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .hud-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .hud-subtitle {
      font-size: 11px;
      color: #64748b;
    }
    .hud-toggles {
      display: flex;
      gap: 12px;
    }
    .toggle-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      vertical-align: middle;
    }

    /* Viewfinder HUD Container */
    .viewfinder-container {
      position: relative;
      width: 100%;
      height: 320px;
      background: #090d16;
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: inset 0 0 20px rgba(0,0,0,0.8);
    }
    .camera-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .hidden-canvas {
      display: none;
    }
    .hidden {
      display: none;
    }
    .camera-standby-view {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      gap: 12px;
      text-align: center;
      padding: 20px;
    }
    .standby-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #475569;
    }
    .standby-text {
      font-size: 13px;
      margin: 0;
    }

    /* Reticle & HUD Overlay */
    .hud-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px;
    }
    .hud-reticle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 220px;
      height: 220px;
      border: 1px dashed rgba(59, 130, 246, 0.4);
      border-radius: 16px;
    }
    .corner {
      position: absolute;
      width: 20px;
      height: 20px;
      border-color: #38bdf8;
      border-style: solid;
    }
    .top-left { top: -2px; left: -2px; border-width: 3px 0 0 3px; border-top-left-radius: 6px; }
    .top-right { top: -2px; right: -2px; border-width: 3px 3px 0 0; border-top-right-radius: 6px; }
    .bottom-left { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; border-bottom-left-radius: 6px; }
    .bottom-right { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; border-bottom-right-radius: 6px; }
    
    .hud-laser-line {
      position: absolute;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, #38bdf8, #60a5fa, transparent);
      box-shadow: 0 0 8px #38bdf8;
      animation: laserSweep 2.5s ease-in-out infinite;
    }
    .hud-target-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: rgba(56, 189, 248, 0.4);
    }
    .hud-target-center mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    /* Recognition Flash Card */
    .recognition-flash-card {
      position: absolute;
      bottom: 12px;
      left: 12px;
      right: 12px;
      background: rgba(15, 23, 42, 0.88);
      backdrop-filter: blur(8px);
      border: 1px solid #22c55e;
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      animation: slideUpFade 0.3s ease-out;
    }
    .flash-avatar {
      width: 46px;
      height: 46px;
      border-radius: 10px;
      overflow: hidden;
      background: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #22c55e;
    }
    .flash-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .flash-avatar mat-icon {
      color: #94a3b8;
    }
    .flash-info {
      flex: 1;
    }
    .flash-status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 2px;
    }
    .flash-status-pill.present {
      background: #22c55e;
      color: #ffffff;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
    }
    .flash-time {
      color: #86efac;
      font-size: 11px;
      font-weight: 700;
    }
    .flash-name {
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
    }
    .flash-meta {
      color: #cbd5e1;
      font-size: 11px;
    }
    .check-success-icon {
      color: #22c55e;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .camera-controls-bar {
      display: flex;
      gap: 10px;
      margin: 12px 0;
      justify-content: center;
    }

    /* Fast Punch Terminal */
    .fast-punch-terminal {
      margin-top: 10px;
    }
    .fast-input-field {
      width: 100%;
    }
    .fast-hints {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #64748b;
      font-size: 11px;
    }
    .fast-hints mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #3b82f6;
    }

    /* Recent Punches Stream */
    .recent-stream-card {
      border-radius: 16px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    .stream-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .stream-header h3 {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin: 0;
      flex: 1;
    }
    .stream-badge {
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .stream-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 240px;
      overflow-y: auto;
    }
    .stream-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }
    .stream-avatar {
      width: 34px;
      height: 34px;
      border-radius: 6px;
      overflow: hidden;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stream-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .stream-details {
      flex: 1;
    }
    .name-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .p-name {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
    }
    .p-time {
      font-size: 11px;
      font-weight: 700;
      color: #16a34a;
    }
    .p-meta {
      font-size: 11px;
      color: #64748b;
    }
    .p-status-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .p-status-pill.present { background: #dcfce7; color: #16a34a; }
    .p-status-pill.late { background: #fef9c3; color: #ca8a04; }
    .p-status-pill.absent { background: #fee2e2; color: #dc2626; }

    /* Roster Column */
    .roster-card {
      border-radius: 16px;
      padding: 20px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .roster-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }
    .roster-title-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .roster-title {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .roster-date-badge {
      background: #eff6ff;
      color: #2563eb;
      font-size: 12px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 999px;
    }
    .roster-search-box .search-input {
      width: 240px;
    }
    .status-chips-bar {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .status-chip-btn {
      font-size: 12px;
      font-weight: 600;
      border-radius: 8px;
      background: #f1f5f9;
      color: #475569;
    }
    .status-chip-btn.selected {
      background: #1e293b;
      color: #ffffff;
    }
    .status-chip-btn.present.selected {
      background: #16a34a;
      color: #ffffff;
    }
    .status-chip-btn.unmarked.selected {
      background: #0284c7;
      color: #ffffff;
    }
    .status-chip-btn.absent.selected {
      background: #dc2626;
      color: #ffffff;
    }
    .status-chip-btn.late.selected {
      background: #ca8a04;
      color: #ffffff;
    }

    /* Roster Table */
    .table-responsive {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }
    .roster-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .roster-table th {
      background: #f8fafc;
      color: #475569;
      font-weight: 700;
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    .roster-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
      white-space: nowrap;
    }
    .roster-table tr:hover {
      background: #f8fafc;
    }
    .roster-table tr.just-punched-row {
      background: #f0fdf4 !important;
      transition: background 0.5s ease;
    }

    .student-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .student-avatar-wrapper {
      position: relative;
      width: 40px;
      height: 40px;
      border-radius: 8px;
      overflow: hidden;
      background: #e2e8f0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .student-avatar-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-camera-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .student-avatar-wrapper:hover .avatar-camera-overlay {
      opacity: 1;
    }
    .avatar-camera-overlay mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .student-details {
      display: flex;
      flex-direction: column;
    }
    .student-name {
      font-weight: 700;
      color: #0f172a;
    }
    .parent-meta {
      font-size: 11px;
      color: #64748b;
    }

    .roll-cell {
      display: flex;
      flex-direction: column;
    }
    .primary-roll {
      font-weight: 700;
      color: #1e3a8a;
    }
    .admission-num {
      font-size: 11px;
      color: #64748b;
    }

    .class-cell {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .class-name {
      font-weight: 600;
      color: #334155;
    }
    .batch-badge {
      background: #e0e7ff;
      color: #3730a3;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .section-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    .status-badge {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      display: inline-block;
    }
    .status-badge.present { background: #dcfce7; color: #15803d; }
    .status-badge.absent { background: #fee2e2; color: #b91c1c; }
    .status-badge.late { background: #fef9c3; color: #a16207; }
    .status-badge.unmarked { background: #f1f5f9; color: #64748b; }

    .punch-time-text {
      font-weight: 700;
      color: #0f172a;
    }
    .unmarked-dash {
      color: #94a3b8;
    }

    .action-buttons-group {
      display: inline-flex;
      gap: 4px;
    }
    .action-btn {
      width: 32px;
      height: 32px;
      line-height: 32px;
    }
    .action-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .present-btn { color: #16a34a; }
    .late-btn { color: #ca8a04; }
    .absent-btn { color: #dc2626; }
    .snap-btn { color: #2563eb; }

    .empty-roster-state {
      text-align: center;
      padding: 40px 20px;
      color: #64748b;
    }
    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
      margin-bottom: 12px;
    }

    @keyframes laserSweep {
      0% { top: 0%; opacity: 0.8; }
      50% { top: 100%; opacity: 1; }
      100% { top: 0%; opacity: 0.8; }
    }
    @keyframes pulse {
      0% { opacity: 0.4; }
      50% { opacity: 1; }
      100% { opacity: 0.4; }
    }
    @keyframes slideUpFade {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `]
})
export class AiAttendanceScannerComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('snapshotCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fastScanInput') fastScanInputRef!: ElementRef<HTMLInputElement>;

  private fb = inject(FormBuilder);
  public authService = inject(AuthService);
  private schoolService = inject(SchoolService);
  private batchesService = inject(BatchesService);
  private scannerService = inject(AiAttendanceScannerService);
  private confirmDialog = inject(ConfirmDialogService);

  isLoading = false;
  isCameraActive = false;
  facingMode: 'user' | 'environment' = 'user';
  private mediaStream: MediaStream | null = null;

  autoVoiceGreeting = true;
  autoWhatsAppAlert = true;

  fastScanTerm = '';
  searchRosterTerm = '';
  rosterStatusFilter: 'all' | 'Present' | 'Absent' | 'Late' | 'Unmarked' = 'all';

  summary: AiAttendanceSummary | null = null;
  roster: AiAttendanceRosterItem[] = [];
  filteredRoster: AiAttendanceRosterItem[] = [];
  lastPunchedStudent: AiAttendanceRosterItem | null = null;

  branches: any[] = [];
  classes: any[] = [];
  sections: any[] = [];
  batches: any[] = [];
  filteredBatches: any[] = [];

  filterForm: FormGroup = this.fb.group({
    divisionScope: ['all'],
    branchId: [''],
    classId: [''],
    sectionId: [''],
    batchId: [''],
    date: [new Date().toISOString().substring(0, 10)]
  });

  get selectedDateStr(): string {
    return this.filterForm.get('date')?.value || new Date().toISOString().substring(0, 10);
  }

  ngOnInit(): void {
    const hasSchool = this.authService.hasSchoolModule();
    const hasCoaching = this.authService.hasCoachingModule();
    const defaultScope = (hasSchool && hasCoaching) ? 'all' : (hasCoaching ? 'coaching' : 'school');

    this.branches = this.authService.currentUser()?.branches || [];
    const activeBranchId = this.authService.selectedBranchId();
    this.filterForm.patchValue({
      divisionScope: defaultScope,
      ...(activeBranchId ? { branchId: activeBranchId } : {})
    }, { emitEvent: false });

    this.loadClassesAndBatches();
    this.setupCascadeListeners();
    this.loadRoster();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private loadClassesAndBatches(): void {
    this.schoolService.getClasses().subscribe({
      next: (res: any) => {
        this.classes = Array.isArray(res) ? res : res?.data || [];
      },
      error: () => {}
    });

    if (this.authService.hasCoachingModule()) {
      this.batchesService.getBatches().subscribe({
        next: (res: any) => {
          this.batches = Array.isArray(res) ? res : res?.data || [];
          this.updateFilteredBatches();
        },
        error: () => {}
      });
    }
  }

  private setupCascadeListeners(): void {
    this.filterForm.get('classId')?.valueChanges.subscribe(classId => {
      this.updateFilteredBatches();
      this.loadSectionsForClass(classId);
      this.loadRoster();
    });

    this.filterForm.get('sectionId')?.valueChanges.subscribe(() => this.loadRoster());
    this.filterForm.get('batchId')?.valueChanges.subscribe(() => this.loadRoster());
    this.filterForm.get('branchId')?.valueChanges.subscribe(() => this.loadRoster());
    this.filterForm.get('date')?.valueChanges.subscribe(() => this.loadRoster());
  }

  setDivisionScope(scope: 'all' | 'school' | 'coaching'): void {
    this.filterForm.patchValue({ divisionScope: scope });
    this.loadRoster();
  }

  private updateFilteredBatches(): void {
    const classId = this.filterForm.get('classId')?.value;
    if (!classId) {
      this.filteredBatches = this.batches;
    } else {
      this.filteredBatches = this.batches.filter(b => b.classId === classId);
    }
  }

  private loadSectionsForClass(classId: string): void {
    if (!classId) {
      this.sections = [];
      this.filterForm.patchValue({ sectionId: '' }, { emitEvent: false });
      return;
    }
    const foundClass = this.classes.find(c => c.id === classId);
    this.sections = foundClass?.sections || [];
    this.filterForm.patchValue({ sectionId: '' }, { emitEvent: false });
  }

  loadRoster(): void {
    this.isLoading = true;
    const fv = this.filterForm.value;

    this.scannerService.getRoster({
      branchId: fv.branchId || undefined,
      divisionScope: fv.divisionScope,
      classId: fv.classId || undefined,
      sectionId: fv.sectionId || undefined,
      batchId: fv.batchId || undefined,
      date: fv.date,
      search: undefined
    }).subscribe({
      next: res => {
        this.isLoading = false;
        this.summary = res.summary;
        this.roster = res.roster;
        this.applyRosterFilter();
      },
      error: err => {
        this.isLoading = false;
        this.confirmDialog.alert('Attendance Error', 'Unable to load attendance roster: ' + (err?.error?.message || err.message));
      }
    });
  }

  applyRosterFilter(): void {
    let result = [...this.roster];

    if (this.rosterStatusFilter !== 'all') {
      result = result.filter(r => r.attendanceStatus === this.rosterStatusFilter);
    }

    if (this.searchRosterTerm.trim()) {
      const term = this.searchRosterTerm.trim().toLowerCase();
      result = result.filter(r =>
        r.studentName.toLowerCase().includes(term) ||
        r.rollNumber.toLowerCase().includes(term) ||
        (r.admissionNumber && r.admissionNumber.toLowerCase().includes(term)) ||
        (r.parentName && r.parentName.toLowerCase().includes(term))
      );
    }

    this.filteredRoster = result;
  }

  setStatusFilter(status: 'all' | 'Present' | 'Absent' | 'Late' | 'Unmarked'): void {
    this.rosterStatusFilter = status;
    this.applyRosterFilter();
  }

  // Camera Management
  async startCamera(): Promise<void> {
    try {
      this.stopCamera();
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.isCameraActive = true;

      setTimeout(() => {
        if (this.videoRef && this.videoRef.nativeElement) {
          this.videoRef.nativeElement.srcObject = this.mediaStream;
        }
      }, 100);
    } catch (err: any) {
      this.isCameraActive = false;
      this.confirmDialog.alert('Camera Access Notice', 'Unable to activate camera viewfinder: ' + (err.message || 'Check camera permissions in your browser.'));
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.isCameraActive = false;
  }

  switchCamera(): void {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.startCamera();
  }

  // Fast Barcode / Roll Entry Punch
  executeFastPunch(): void {
    const term = this.fastScanTerm.trim();
    if (!term) return;

    const lowerTerm = term.toLowerCase();
    const matched = this.roster.find(r =>
      r.rollNumber.toLowerCase() === lowerTerm ||
      (r.schoolRollNumber && r.schoolRollNumber.toLowerCase() === lowerTerm) ||
      (r.coachingRollNumber && r.coachingRollNumber.toLowerCase() === lowerTerm) ||
      (r.admissionNumber && r.admissionNumber.toLowerCase() === lowerTerm) ||
      r.studentName.toLowerCase() === lowerTerm
    ) || this.roster.find(r => r.studentName.toLowerCase().includes(lowerTerm));

    if (!matched) {
      this.playChime(false);
      this.confirmDialog.alert('Student Not Found', `No student in active roster matches "${term}". Try adjusting the Class or Batch filter.`);
      return;
    }

    this.punchStudent(matched, 'Present');
    this.fastScanTerm = '';
    if (this.fastScanInputRef) {
      this.fastScanInputRef.nativeElement.focus();
    }
  }

  // Punch Attendance Core Method
  punchStudent(student: AiAttendanceRosterItem, status: 'Present' | 'Absent' | 'Late'): void {
    this.scannerService.punchAttendance({
      studentId: student.studentId,
      attendanceDate: this.selectedDateStr,
      status: status,
      remarks: 'AI Camera Scanner Punch',
      sendWhatsAppAlert: this.autoWhatsAppAlert
    }).subscribe({
      next: res => {
        this.playChime(status === 'Present');
        this.lastPunchedStudent = res.punch;

        // Update student in local roster
        const index = this.roster.findIndex(r => r.studentId === student.studentId);
        if (index !== -1) {
          this.roster[index] = res.punch;
        }

        // Recalculate summary locally
        if (this.summary) {
          this.summary.presentCount = this.roster.filter(r => r.attendanceStatus === 'Present').length;
          this.summary.absentCount = this.roster.filter(r => r.attendanceStatus === 'Absent').length;
          this.summary.lateCount = this.roster.filter(r => r.attendanceStatus === 'Late').length;
          this.summary.unmarkedCount = this.roster.filter(r => r.attendanceStatus === 'Unmarked').length;
          this.summary.attendancePercentage = this.summary.totalStudents > 0
            ? Math.round((this.summary.presentCount / this.summary.totalStudents) * 1000) / 10
            : 0;
          this.summary.recentPunches = [res.punch, ...this.summary.recentPunches.filter(p => p.studentId !== res.punch.studentId)].slice(0, 10);
        }

        this.applyRosterFilter();

        if (this.autoVoiceGreeting && status === 'Present') {
          this.speakGreeting(student.studentName);
        }
      },
      error: err => {
        this.playChime(false);
        this.confirmDialog.alert('Punch Failed', 'Could not record attendance: ' + (err?.error?.message || err.message));
      }
    });
  }

  // Mark all pending/unmarked students as Present in 1 click
  markAllUnmarkedAsPresent(): void {
    const unmarked = this.roster.filter(r => r.attendanceStatus === 'Unmarked');
    if (unmarked.length === 0) return;

    this.confirmDialog.confirm(
      'Bulk Attendance Confirmation',
      `Mark all ${unmarked.length} pending students as PRESENT for ${this.selectedDateStr}?`
    ).subscribe(confirmed => {
      if (!confirmed) return;

      this.isLoading = true;
      const ids = unmarked.map(u => u.studentId);

      this.scannerService.bulkPunch({
        studentIds: ids,
        attendanceDate: this.selectedDateStr,
        status: 'Present',
        remarks: 'AI Scanner Class Bulk Punch',
        sendWhatsAppAlert: false
      }).subscribe({
        next: () => {
          this.isLoading = false;
          this.playChime(true);
          this.loadRoster();
        },
        error: err => {
          this.isLoading = false;
          this.confirmDialog.alert('Bulk Punch Failed', err?.error?.message || err.message);
        }
      });
    });
  }

  // Capture Photo for Student from Camera Stream
  capturePhotoForStudent(student: AiAttendanceRosterItem): void {
    if (!this.isCameraActive) {
      this.confirmDialog.alert('Camera Standby', 'Please start the AI Camera first to capture profile photos.');
      return;
    }

    try {
      const video = this.videoRef.nativeElement;
      const canvas = this.canvasRef.nativeElement;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const base64 = canvas.toDataURL('image/jpeg', 0.85);

      this.isLoading = true;
      this.scannerService.captureStudentPhoto(student.studentId, base64).subscribe({
        next: res => {
          this.isLoading = false;
          student.profilePhoto = res.photoUrl;
          this.playChime(true);
          this.confirmDialog.alert('Photo Captured', `Profile photo successfully updated for ${student.studentName}!`);
        },
        error: err => {
          this.isLoading = false;
          this.confirmDialog.alert('Photo Upload Failed', err?.error?.message || err.message);
        }
      });
    } catch (err: any) {
      this.confirmDialog.alert('Capture Error', err.message);
    }
  }

  // Web Audio Synthetic Chime (Zero MP3 Dependencies)
  private playChime(isSuccess: boolean): void {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 587.33 : 220, audioCtx.currentTime); // D5 or A3
      if (isSuccess) {
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      }

      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {}
  }

  // Web Speech Synthesis Voice Greeting
  private speakGreeting(studentName: string): void {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(`Namaste ${studentName}, upasthiti darj ho gayi hai.`);
      utterance.lang = 'hi-IN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch {}
  }
}
